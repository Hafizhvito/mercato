"use server";

import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { emailService } from "@/lib/email";
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

export async function inviteStaffAction(input: { email: string; role: "staff" | "admin" }) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "staff:manage");

  if (input.role !== "staff" && input.role !== "admin") {
    throw new Error("Invalid role specified. Only 'staff' or 'admin' roles can be invited.");
  }

  // Admin cannot invite owners
  if (user.role === "admin" && (input.role as string) === "owner") {
    throw new Error("Permission denied: Only store owners can invite or promote owners.");
  }

  const trimmedEmail = input.email.trim().toLowerCase();
  if (!trimmedEmail?.includes("@")) {
    throw new Error("Invalid email address.");
  }

  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found.");

  // Generate 32-byte secure hex token (64 hex characters)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hour TTL

  const [invitation] = await db.transaction(async (tx) => {
    // Invalidate prior pending invitations for this email
    await tx
      .delete(schema.staffInvitations)
      .where(
        and(
          eq(schema.staffInvitations.email, trimmedEmail),
          eq(schema.staffInvitations.storeId, store.id),
        ),
      );

    const [created] = await tx
      .insert(schema.staffInvitations)
      .values({
        storeId: store.id,
        email: trimmedEmail,
        role: input.role,
        token,
        invitedBy: user.id,
        expiresAt,
      })
      .returning();

    if (!created) {
      throw new Error("Gagal membuat data undangan");
    }

    // Audit log (sanitized: only email & role, never the token)
    await tx.insert(schema.auditLogs).values({
      storeId: store.id,
      userId: user.id,
      action: "staff.invited",
      entityType: "staff_invitation",
      entityId: created.id,
      details: JSON.stringify({ email: trimmedEmail, role: input.role }),
    });

    return created;
  });

  if (!invitation) {
    throw new Error("Gagal memproses undangan staf");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/admin/accept-invite?token=${token}`;

  await emailService.sendStaffInviteEmail({
    to: trimmedEmail,
    role: input.role,
    inviteUrl,
    token,
    expiresAt,
  });

  revalidatePath("/admin/settings");
  return { success: true, invitationId: invitation.id };
}

export async function getStaffInviteAction(token: string) {
  if (!token?.trim()) {
    return { valid: false, error: "Token undangan tidak valid." };
  }

  const [invite] = await db
    .select()
    .from(schema.staffInvitations)
    .where(eq(schema.staffInvitations.token, token.trim()))
    .limit(1);

  if (!invite) {
    return { valid: false, error: "Tautan undangan tidak ditemukan atau sudah tidak berlaku." };
  }

  if (invite.acceptedAt) {
    return { valid: false, error: "Undangan ini telah digunakan sebelumnya." };
  }

  if (new Date() > new Date(invite.expiresAt)) {
    return {
      valid: false,
      error: "Undangan telah kedaluwarsa. Silakan minta admin mengirimkan undangan baru.",
    };
  }

  return { valid: true, email: invite.email, role: invite.role };
}

export async function acceptStaffInviteAction(input: {
  token: string;
  name: string;
  password: string;
}) {
  const token = input.token?.trim();
  const name = input.name?.trim();
  const password = input.password;

  if (!token) throw new Error("Token undangan wajib disertakan.");
  if (!name || name.length < 2) throw new Error("Nama minimal 2 karakter.");
  if (!password || password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }

  return await db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(schema.staffInvitations)
      .where(eq(schema.staffInvitations.token, token))
      .limit(1);

    if (!invite) {
      throw new Error("Tautan undangan tidak valid.");
    }
    if (invite.acceptedAt) {
      throw new Error("Undangan ini sudah digunakan.");
    }
    if (new Date() > new Date(invite.expiresAt)) {
      throw new Error("Undangan telah kedaluwarsa.");
    }

    // Check if user already exists
    const [existingUser] = await tx
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, invite.email))
      .limit(1);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await tx
        .update(schema.user)
        .set({
          name,
          role: invite.role,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, existingUser.id));
    } else {
      userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await tx.insert(schema.user).values({
        id: userId,
        name,
        email: invite.email,
        role: invite.role,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Hash password and store in account table
    const hashedPassword = await hashPassword(password);
    const [existingAccount] = await tx
      .select()
      .from(schema.account)
      .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")))
      .limit(1);

    if (existingAccount) {
      await tx
        .update(schema.account)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(schema.account.id, existingAccount.id));
    } else {
      await tx.insert(schema.account).values({
        id: `acc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Mark invitation accepted
    await tx
      .update(schema.staffInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.staffInvitations.id, invite.id));

    // Audit log
    await tx.insert(schema.auditLogs).values({
      storeId: invite.storeId,
      userId,
      action: "staff.invite_accepted",
      entityType: "user",
      entityId: userId,
      details: JSON.stringify({ email: invite.email, role: invite.role }),
    });

    return { success: true, email: invite.email };
  });
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
