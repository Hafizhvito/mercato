"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sanitizeAuditDetails } from "@/server/audit-log";
import { assertPermission } from "@/server/guards";

async function getAuthenticatedUser() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    throw new Error("Authentication required: Please log in to manage discounts.");
  }
  return session.user;
}

async function getPrimaryStoreId(userStoreId?: string | null): Promise<string> {
  if (userStoreId) return userStoreId;
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found");
  return store.id;
}

export interface SaveDiscountInput {
  id?: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  minSpend?: number;
  maxDiscount?: number | null;
  startsAt?: string;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isActive?: boolean;
}

export async function createDiscountAction(input: SaveDiscountInput) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "discounts:manage");

  const storeId = await getPrimaryStoreId((user as { storeId?: string | null }).storeId);
  const cleanCode = input.code.trim().toUpperCase();

  if (!cleanCode || cleanCode.length < 3) {
    throw new Error("Kode kupon minimal 3 karakter.");
  }

  if (input.type === "percentage" && (input.value <= 0 || input.value > 100)) {
    throw new Error("Persentase diskon harus bernilai antara 1% hingga 100%.");
  }

  if (input.type === "fixed" && input.value <= 0) {
    throw new Error("Potongan harga tetap harus lebih besar dari 0.");
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  if (expiresAt && expiresAt <= startsAt) {
    throw new Error("Waktu kedaluwarsa kupon harus lebih besar dari waktu mulai.");
  }

  const [discount] = await db.transaction(async (tx) => {
    // Check code uniqueness
    const [existing] = await tx
      .select({ id: schema.discounts.id })
      .from(schema.discounts)
      .where(and(eq(schema.discounts.storeId, storeId), eq(schema.discounts.code, cleanCode)))
      .limit(1);

    if (existing) {
      throw new Error(`Kupon dengan kode '${cleanCode}' sudah terdaftar.`);
    }

    const [created] = await tx
      .insert(schema.discounts)
      .values({
        storeId,
        code: cleanCode,
        type: input.type,
        value: input.type === "free_shipping" ? 0 : input.value,
        minSpend: input.minSpend || 0,
        maxDiscount: input.maxDiscount || null,
        startsAt,
        expiresAt,
        usageLimit: input.usageLimit || null,
        perCustomerLimit: input.perCustomerLimit || null,
        isActive: input.isActive ?? true,
      })
      .returning();

    if (!created) {
      throw new Error("Gagal membuat kupon diskon.");
    }

    await tx.insert(schema.auditLogs).values({
      storeId,
      userId: user.id,
      action: "discount.created",
      entityType: "discount",
      entityId: created.id,
      details: JSON.stringify(
        sanitizeAuditDetails({
          code: cleanCode,
          type: input.type,
          value: input.value,
        }),
      ),
    });

    return [created];
  });

  revalidatePath("/admin/discounts");
  return { success: true, discount };
}

export async function updateDiscountAction(input: SaveDiscountInput & { id: string }) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "discounts:manage");

  const cleanCode = input.code.trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 3) {
    throw new Error("Kode kupon minimal 3 karakter.");
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const [existing] = await db
    .select()
    .from(schema.discounts)
    .where(eq(schema.discounts.id, input.id))
    .limit(1);

  if (!existing) {
    throw new Error("Diskon tidak ditemukan.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.discounts)
      .set({
        code: cleanCode,
        type: input.type,
        value: input.type === "free_shipping" ? 0 : input.value,
        minSpend: input.minSpend || 0,
        maxDiscount: input.maxDiscount || null,
        startsAt,
        expiresAt,
        usageLimit: input.usageLimit || null,
        perCustomerLimit: input.perCustomerLimit || null,
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(schema.discounts.id, input.id));

    await tx.insert(schema.auditLogs).values({
      storeId: existing.storeId,
      userId: user.id,
      action: "discount.updated",
      entityType: "discount",
      entityId: input.id,
      details: JSON.stringify(
        sanitizeAuditDetails({
          code: cleanCode,
          type: input.type,
          value: input.value,
        }),
      ),
    });
  });

  revalidatePath("/admin/discounts");
  return { success: true };
}

export async function toggleDiscountAction(id: string) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "discounts:manage");

  const [existing] = await db
    .select()
    .from(schema.discounts)
    .where(eq(schema.discounts.id, id))
    .limit(1);

  if (!existing) {
    throw new Error("Diskon tidak ditemukan.");
  }

  const nextStatus = !existing.isActive;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.discounts)
      .set({
        isActive: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.discounts.id, id));

    await tx.insert(schema.auditLogs).values({
      storeId: existing.storeId,
      userId: user.id,
      action: nextStatus ? "discount.activated" : "discount.deactivated",
      entityType: "discount",
      entityId: id,
      details: JSON.stringify(sanitizeAuditDetails({ code: existing.code, isActive: nextStatus })),
    });
  });

  revalidatePath("/admin/discounts");
  return { success: true, isActive: nextStatus };
}

export async function deleteDiscountAction(id: string) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "discounts:manage");

  const [existing] = await db
    .select()
    .from(schema.discounts)
    .where(eq(schema.discounts.id, id))
    .limit(1);

  if (!existing) {
    throw new Error("Diskon tidak ditemukan.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.discounts).where(eq(schema.discounts.id, id));

    await tx.insert(schema.auditLogs).values({
      storeId: existing.storeId,
      userId: user.id,
      action: "discount.deleted",
      entityType: "discount",
      entityId: id,
      details: JSON.stringify(sanitizeAuditDetails({ code: existing.code })),
    });
  });

  revalidatePath("/admin/discounts");
  return { success: true };
}
