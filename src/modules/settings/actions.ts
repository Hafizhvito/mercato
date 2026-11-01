"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { assertPermission, assertStaffModificationAllowed, type UserRole } from "@/server/guards";

async function getAuthenticatedUser() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    throw new Error("Authentication required: Please log in to manage store settings.");
  }
  return session.user;
}

export interface UpdateStoreSettingsInput {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  lowStockThreshold: number;
  taxRatePercent: number;
  taxInclusive: boolean;
  shippingFlatRates?: Record<string, number>;
}

export async function updateStoreSettingsAction(input: UpdateStoreSettingsInput) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "settings:manage");

  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) throw new Error("Store not found");

  const trimmedName = input.name?.trim();
  if (!trimmedName || trimmedName.length < 2) {
    throw new Error("Nama toko minimal 2 karakter.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.stores)
      .set({
        name: trimmedName,
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        address: input.address?.trim() || null,
        lowStockThreshold: Math.max(0, input.lowStockThreshold || 5),
        taxRatePercent: Math.max(0, input.taxRatePercent || 0),
        taxInclusive: Boolean(input.taxInclusive),
        shippingFlatRates: input.shippingFlatRates || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.stores.id, store.id));

    await tx.insert(schema.auditLogs).values({
      storeId: store.id,
      userId: user.id,
      action: "settings.store_updated",
      entityType: "store",
      entityId: store.id,
      details: JSON.stringify({
        name: trimmedName,
        lowStockThreshold: input.lowStockThreshold,
        taxRatePercent: input.taxRatePercent,
        taxInclusive: input.taxInclusive,
      }),
    });
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function createStaffAccountAction(input: {
  name: string;
  email: string;
  role: "staff" | "admin";
}) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "staff:manage");

  const trimmedName = input.name.trim();
  const trimmedEmail = input.email.trim().toLowerCase();

  if (!trimmedName || trimmedName.length < 2) {
    throw new Error("Nama staf minimal 2 karakter.");
  }

  if (!trimmedEmail.includes("@")) {
    throw new Error("Format alamat email tidak valid.");
  }

  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  const storeId = store?.id || "";

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, trimmedEmail))
      .limit(1);

    if (existing) {
      // If user exists, check modification rules
      const [ownerCountRow] = await tx
        .select({ count: count() })
        .from(schema.user)
        .where(eq(schema.user.role, "owner"));

      assertStaffModificationAllowed({
        currentUser: user,
        targetUserId: existing.id,
        targetUserRole: existing.role as UserRole,
        newRole: input.role,
        ownerCount: ownerCountRow?.count ?? 1,
      });

      const [updated] = await tx
        .update(schema.user)
        .set({
          name: trimmedName,
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, existing.id))
        .returning();

      if (storeId) {
        await tx.insert(schema.auditLogs).values({
          storeId,
          userId: user.id,
          action: "staff.role_updated",
          entityType: "user",
          entityId: existing.id,
          details: JSON.stringify({ email: trimmedEmail, newRole: input.role }),
        });
      }

      return updated;
    } else {
      // Create new staff user
      const [created] = await tx
        .insert(schema.user)
        .values({
          id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: trimmedName,
          email: trimmedEmail,
          role: input.role,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (storeId) {
        await tx.insert(schema.auditLogs).values({
          storeId,
          userId: user.id,
          action: "staff.created",
          entityType: "user",
          entityId: created?.id ?? "",
          details: JSON.stringify({ email: trimmedEmail, role: input.role }),
        });
      }

      return created;
    }
  });

  revalidatePath("/admin/settings");
  return { success: true, user: result };
}

export async function updateStaffRoleAction(input: {
  targetUserId: string;
  newRole: "staff" | "admin" | "owner" | "customer";
}) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "staff:manage");

  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  const storeId = store?.id || "";

  await db.transaction(async (tx) => {
    const [targetUser] = await tx
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, input.targetUserId))
      .limit(1);

    if (!targetUser) throw new Error("Staff user not found");

    const [ownerCountRow] = await tx
      .select({ count: count() })
      .from(schema.user)
      .where(eq(schema.user.role, "owner"));

    assertStaffModificationAllowed({
      currentUser: user,
      targetUserId: targetUser.id,
      targetUserRole: targetUser.role as UserRole,
      newRole: input.newRole,
      ownerCount: ownerCountRow?.count ?? 1,
    });

    await tx
      .update(schema.user)
      .set({
        role: input.newRole,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, targetUser.id));

    if (storeId) {
      await tx.insert(schema.auditLogs).values({
        storeId,
        userId: user.id,
        action: "staff.role_updated",
        entityType: "user",
        entityId: targetUser.id,
        details: JSON.stringify({
          fromRole: targetUser.role,
          toRole: input.newRole,
        }),
      });
    }
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
