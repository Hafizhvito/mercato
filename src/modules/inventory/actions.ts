"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sanitizeAuditDetails } from "@/server/audit-log";
import { assertPermission, assertStoreAccess } from "@/server/guards";

async function getAuthenticatedUser() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    throw new Error("Authentication required: Please log in to adjust inventory.");
  }
  return session.user;
}

export interface AdjustStockInput {
  variantId: string;
  delta: number;
  reason: string;
}

/**
 * Adjusts inventory stock for a product variant with row-level locking (SELECT ... FOR UPDATE).
 * Enforces:
 * - inventory:adjust permission check
 * - Reason is mandatory and non-empty
 * - Stock cannot be reduced below zero
 * - Writes immutable audit record to stock_adjustments and audit_logs
 */
export async function adjustStockAction(input: AdjustStockInput) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "inventory:adjust");

  const trimmedReason = input.reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new Error("Penyesuaian stok memerlukan alasan tertulis (minimal 3 karakter).");
  }

  if (input.delta === 0) {
    throw new Error("Perubahan stok (delta) tidak boleh nol.");
  }

  const result = await db.transaction(async (tx) => {
    // 1. Lock the variant row and fetch product details
    const [row] = await tx
      .select({
        variantId: schema.productVariants.id,
        currentStock: schema.productVariants.stock,
        sku: schema.productVariants.sku,
        variantTitle: schema.productVariants.title,
        storeId: schema.products.storeId,
        productName: schema.products.name,
      })
      .from(schema.productVariants)
      .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
      .where(eq(schema.productVariants.id, input.variantId))
      .for("update");

    if (!row) {
      throw new Error(`Varian produk dengan ID ${input.variantId} tidak ditemukan.`);
    }

    assertStoreAccess(user, row.storeId);

    const previousStock = row.currentStock;
    const newStock = previousStock + input.delta;

    if (newStock < 0) {
      throw new Error(
        `Penyesuaian stok ditolak: Stok fisik tidak boleh bernilai negatif (stok saat ini: ${previousStock}, perubahan: ${input.delta}, hasil: ${newStock}).`,
      );
    }

    // 2. Update variant stock
    await tx
      .update(schema.productVariants)
      .set({
        stock: newStock,
        updatedAt: new Date(),
      })
      .where(eq(schema.productVariants.id, row.variantId));

    // 3. Insert into stock_adjustments ledger
    const [adjustment] = await tx
      .insert(schema.stockAdjustments)
      .values({
        storeId: row.storeId,
        variantId: row.variantId,
        userId: user.id,
        userName: user.name || user.email || "Staff",
        previousStock,
        newStock,
        delta: input.delta,
        reason: trimmedReason,
      })
      .returning();

    // 4. Insert into system audit logs
    await tx.insert(schema.auditLogs).values({
      storeId: row.storeId,
      userId: user.id,
      action: "inventory.stock_adjusted",
      entityType: "product_variant",
      entityId: row.variantId,
      details: JSON.stringify(
        sanitizeAuditDetails({
          sku: row.sku,
          productName: row.productName,
          variantTitle: row.variantTitle,
          previousStock,
          newStock,
          delta: input.delta,
          reason: trimmedReason,
        }),
      ),
    });

    return {
      success: true,
      adjustmentId: adjustment?.id ?? "",
      sku: row.sku,
      previousStock,
      newStock,
      delta: input.delta,
    };
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/admin/dashboard");

  return result;
}

/**
 * Retrieves the recent stock adjustment history for a specific variant.
 */
export async function getStockAdjustmentHistoryAction(variantId: string) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "inventory:view");

  return db
    .select()
    .from(schema.stockAdjustments)
    .where(eq(schema.stockAdjustments.variantId, variantId))
    .orderBy(desc(schema.stockAdjustments.createdAt))
    .limit(50);
}
