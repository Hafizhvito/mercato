import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogService } from "@/modules/catalog/service";
import { inventoryService } from "@/modules/inventory/service";

describe("Phase 5: Inventory Stock Adjustments & Concurrency Suite", () => {
  let storeId: string;
  let testUserId: string;
  let _productId: string;
  let variantId: string;
  let initialStockSku: string;

  beforeAll(async () => {
    // 1. Create a test store
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Inventory Test Store",
        slug: `inv-store-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    if (!store) throw new Error("Store creation failed");
    storeId = store.id;

    // 2. Create a test user (staff)
    const [u] = await db
      .insert(schema.user)
      .values({
        id: `staff-inv-${Date.now()}`,
        name: "Staff Inventory Tester",
        email: `staff-inv-${Date.now()}@mercato.local`,
        role: "staff",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!u) throw new Error("User creation failed");
    testUserId = u.id;

    // 3. Create test product & variant
    initialStockSku = `SKU-INV-${Date.now()}`;
    const product = await catalogService.createProductWithVariants(storeId, {
      name: "Inventory Concurrency Item",
      description: "Testing concurrency and adjustments",
      status: "published",
      variants: [
        {
          sku: initialStockSku,
          title: "Standard",
          price: 50_000,
          stock: 6,
        },
      ],
    });
    _productId = product.id;
    const firstVariant = product.variants[0];
    if (!firstVariant) throw new Error("Variant creation failed");
    variantId = firstVariant.id;
  });

  afterAll(async () => {
    if (storeId) {
      await db.delete(schema.stores).where(eq(schema.stores.id, storeId));
    }
    if (testUserId) {
      await db.delete(schema.user).where(eq(schema.user.id, testUserId));
    }
  });

  it("adjusts stock upwards and writes ledger + audit log", async () => {
    const delta = 10;
    const reason = "Supplier restock batch #9921";

    const [variant] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));

    if (!variant) throw new Error("Variant not found");
    const prevStock = variant.stock;

    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(schema.productVariants)
        .where(eq(schema.productVariants.id, variantId))
        .for("update");

      if (!locked) throw new Error("Locked variant not found");
      const newStock = locked.stock + delta;

      await tx
        .update(schema.productVariants)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(schema.productVariants.id, variantId));

      await tx.insert(schema.stockAdjustments).values({
        storeId,
        variantId,
        userId: testUserId,
        userName: "Staff Tester",
        previousStock: prevStock,
        newStock,
        delta,
        reason,
      });

      await tx.insert(schema.auditLogs).values({
        storeId,
        userId: testUserId,
        action: "inventory.stock_adjusted",
        entityType: "product_variant",
        entityId: variantId,
        details: JSON.stringify({ previousStock: prevStock, newStock, delta, reason }),
      });
    });

    const [updated] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));

    if (!updated) throw new Error("Updated variant not found");
    expect(updated.stock).toBe(prevStock + delta);

    // Verify stock adjustment ledger entry
    const [adjustment] = await db
      .select()
      .from(schema.stockAdjustments)
      .where(eq(schema.stockAdjustments.variantId, variantId));

    expect(adjustment).toBeDefined();
    expect(adjustment?.delta).toBe(10);
    expect(adjustment?.reason).toBe(reason);

    // Verify audit log entry
    const [auditLog] = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityId, variantId),
          eq(schema.auditLogs.action, "inventory.stock_adjusted"),
        ),
      );
    expect(auditLog).toBeDefined();
  });

  it("prevents stock reduction below zero", async () => {
    const [variant] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));

    if (!variant) throw new Error("Variant not found");
    const attemptDeduct = variant.stock + 1; // 1 more than available

    await expect(
      db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(schema.productVariants)
          .where(eq(schema.productVariants.id, variantId))
          .for("update");

        if (!locked) throw new Error("Locked variant not found");
        const newStock = locked.stock - attemptDeduct;
        if (newStock < 0) {
          throw new Error("Cannot reduce stock below zero");
        }

        await tx
          .update(schema.productVariants)
          .set({ stock: newStock })
          .where(eq(schema.productVariants.id, variantId));
      }),
    ).rejects.toThrow("Cannot reduce stock below zero");

    // Verify stock unchanged
    const [recheck] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));

    expect(recheck?.stock).toBe(variant.stock);
  });

  it("handles 10 concurrent stock reductions against 6 units: exactly 3 succeed, 7 fail, final stock 0", async () => {
    // Reset variant stock to exactly 6
    await db
      .update(schema.productVariants)
      .set({ stock: 6 })
      .where(eq(schema.productVariants.id, variantId));

    const delta = -2; // Deduct 2 units each
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      try {
        return await db.transaction(async (tx) => {
          const [locked] = await tx
            .select()
            .from(schema.productVariants)
            .where(eq(schema.productVariants.id, variantId))
            .for("update");

          if (!locked) throw new Error("Locked variant not found");
          const nextStock = locked.stock + delta;
          if (nextStock < 0) {
            throw new Error(`Insufficient stock for deduction (current: ${locked.stock})`);
          }

          await tx
            .update(schema.productVariants)
            .set({ stock: nextStock, updatedAt: new Date() })
            .where(eq(schema.productVariants.id, variantId));

          await tx.insert(schema.stockAdjustments).values({
            storeId,
            variantId,
            userId: testUserId,
            userName: `Staff Worker ${i}`,
            previousStock: locked.stock,
            newStock: nextStock,
            delta,
            reason: `Concurrent deduction ${i}`,
          });

          return { success: true };
        });
      } catch {
        return { success: false };
      }
    });

    const results = await Promise.all(tasks.map((t) => t()));
    const successes = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success).length;

    expect(successes).toBe(3); // 3 * 2 = 6 units deducted
    expect(failures).toBe(7);

    // Final physical stock must be exactly 0, never negative
    const [finalVariant] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));

    expect(finalVariant?.stock).toBe(0);
  });

  it("calculates real-time available stock taking active reservations into account", async () => {
    // Set stock to 10
    await db
      .update(schema.productVariants)
      .set({ stock: 10 })
      .where(eq(schema.productVariants.id, variantId));

    // Create an active reservation for 3 units
    const sessionA = `sess-res-${Date.now()}`;
    const reservationRes = await inventoryService.reserveStock({
      storeId,
      checkoutSessionId: sessionA,
      items: [{ variantId, quantity: 3 }],
    });

    expect(reservationRes.success).toBe(true);

    const available = await inventoryService.getAvailableStock(variantId);
    expect(available).toBe(7); // 10 - 3 = 7

    // Clean up reservation
    await inventoryService.releaseReservations(sessionA);

    const availableAfterRelease = await inventoryService.getAvailableStock(variantId);
    expect(availableAfterRelease).toBe(10);
  });
});
