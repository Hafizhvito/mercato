import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { StockReservation } from "./schema";

export const RESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface ReservationItemInput {
  variantId: string;
  quantity: number;
}

export class InventoryService {
  /**
   * Lazily expires past-due reservations for a specific variant or globally
   */
  async sweepExpiredReservations(variantId?: string): Promise<{ sweptCount: number }> {
    const now = new Date();
    const conditions = [
      eq(schema.stockReservations.status, "active"),
      lt(schema.stockReservations.reservedUntil, now),
    ];

    if (variantId) {
      conditions.push(eq(schema.stockReservations.variantId, variantId));
    }

    const updated = await db
      .update(schema.stockReservations)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(and(...conditions))
      .returning();

    return { sweptCount: updated.length };
  }

  /**
   * Checks current real-time available stock taking active reservations into account
   */
  async getAvailableStock(variantId: string): Promise<number> {
    await this.sweepExpiredReservations(variantId);

    const [variant] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId))
      .limit(1);

    if (!variant) return 0;

    const [reservedResult] = await db
      .select({
        reserved: sql<number>`COALESCE(SUM(${schema.stockReservations.quantity}), 0)`,
      })
      .from(schema.stockReservations)
      .where(
        and(
          eq(schema.stockReservations.variantId, variantId),
          eq(schema.stockReservations.status, "active"),
          gte(schema.stockReservations.reservedUntil, new Date()),
        ),
      );

    const reservedCount = Number(reservedResult?.reserved ?? 0);
    return Math.max(0, variant.stock - reservedCount);
  }

  /**
   * Reserves inventory with row-level locking (SELECT ... FOR UPDATE) and 15-minute TTL.
   * Runs within an atomic interactive transaction.
   */
  async reserveStock(params: {
    storeId: string;
    checkoutSessionId: string;
    items: ReservationItemInput[];
  }): Promise<{ success: boolean; reservations: StockReservation[]; error?: string }> {
    const now = new Date();
    const reservedUntil = new Date(now.getTime() + RESERVATION_TTL_MS);

    try {
      const createdReservations = await db.transaction(async (tx) => {
        const reservations: StockReservation[] = [];

        // Sort items by variantId to prevent database deadlocks on concurrent multi-item transactions
        const sortedItems = [...params.items].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        );

        for (const item of sortedItems) {
          // 1. Sweep expired reservations for this variant within this transaction
          await tx
            .update(schema.stockReservations)
            .set({ status: "expired", updatedAt: now })
            .where(
              and(
                eq(schema.stockReservations.variantId, item.variantId),
                eq(schema.stockReservations.status, "active"),
                lt(schema.stockReservations.reservedUntil, now),
              ),
            );

          // 2. Lock variant row with SELECT ... FOR UPDATE
          const [lockedVariant] = await tx
            .select({
              id: schema.productVariants.id,
              stock: schema.productVariants.stock,
              sku: schema.productVariants.sku,
            })
            .from(schema.productVariants)
            .where(eq(schema.productVariants.id, item.variantId))
            .for("update");

          if (!lockedVariant) {
            throw new Error(`Variant ${item.variantId} does not exist`);
          }

          // 3. Calculate currently active held stock
          const [activeHeldResult] = await tx
            .select({
              reserved: sql<number>`COALESCE(SUM(${schema.stockReservations.quantity}), 0)`,
            })
            .from(schema.stockReservations)
            .where(
              and(
                eq(schema.stockReservations.variantId, item.variantId),
                eq(schema.stockReservations.status, "active"),
                gte(schema.stockReservations.reservedUntil, now),
              ),
            );

          const totalHeld = Number(activeHeldResult?.reserved ?? 0);
          const availableStock = lockedVariant.stock - totalHeld;

          if (availableStock < item.quantity) {
            throw new Error(
              `Insufficient stock for SKU "${lockedVariant.sku}". Requested: ${item.quantity}, Available: ${Math.max(0, availableStock)}`,
            );
          }

          // 4. Create stock reservation record
          const [reservation] = await tx
            .insert(schema.stockReservations)
            .values({
              storeId: params.storeId,
              variantId: item.variantId,
              quantity: item.quantity,
              status: "active",
              checkoutSessionId: params.checkoutSessionId,
              reservedUntil,
            })
            .returning();

          if (!reservation) {
            throw new Error(`Failed to create reservation for ${item.variantId}`);
          }

          reservations.push(reservation);
        }

        return reservations;
      });

      return { success: true, reservations: createdReservations };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Inventory reservation failed";
      return { success: false, reservations: [], error: message };
    }
  }

  /**
   * Releases an active reservation prematurely (e.g. user cancels checkout or changes cart)
   */
  async releaseReservations(checkoutSessionId: string): Promise<number> {
    const updated = await db
      .update(schema.stockReservations)
      .set({
        status: "released",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.stockReservations.checkoutSessionId, checkoutSessionId),
          eq(schema.stockReservations.status, "active"),
        ),
      )
      .returning();

    return updated.length;
  }

  /**
   * Commits stock reservations upon payment success: decrements variant stock
   * and marks reservations as 'committed'.
   */
  async commitReservations(checkoutSessionId: string, orderId: string): Promise<number> {
    const now = new Date();

    return db.transaction(async (tx) => {
      const activeReservations = await tx
        .select()
        .from(schema.stockReservations)
        .where(
          and(
            eq(schema.stockReservations.checkoutSessionId, checkoutSessionId),
            eq(schema.stockReservations.status, "active"),
          ),
        );

      for (const res of activeReservations) {
        // Lock and decrement variant stock
        await tx
          .update(schema.productVariants)
          .set({
            stock: sql`${schema.productVariants.stock} - ${res.quantity}`,
            updatedAt: now,
          })
          .where(eq(schema.productVariants.id, res.variantId));

        // Mark reservation as committed
        await tx
          .update(schema.stockReservations)
          .set({
            status: "committed",
            orderId,
            updatedAt: now,
          })
          .where(eq(schema.stockReservations.id, res.id));
      }

      return activeReservations.length;
    });
  }
}

export const inventoryService = new InventoryService();
