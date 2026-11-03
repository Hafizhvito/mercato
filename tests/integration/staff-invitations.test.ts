import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { acceptStaffInviteAction, getStaffInviteAction } from "@/modules/settings/actions";
import { assertStaffModificationAllowed } from "@/server/guards";

function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

describe("Phase 5: Staff Invite Flow & Governance Integration Suite", () => {
  let storeId: string;
  let ownerUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // 1. Create store
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Staff Test Store",
        slug: `staff-store-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeId = store!.id;

    // 2. Create Owner User
    const [owner] = await db
      .insert(schema.user)
      .values({
        id: `usr-owner-${Date.now()}`,
        name: "Store Owner",
        email: `owner-${Date.now()}@example.test`,
        role: "owner",
        emailVerified: true,
      })
      .returning();
    ownerUserId = owner!.id;

    // 3. Create Admin User
    const [admin] = await db
      .insert(schema.user)
      .values({
        id: `usr-admin-${Date.now()}`,
        name: "Store Admin",
        email: `admin-${Date.now()}@example.test`,
        role: "admin",
        emailVerified: true,
      })
      .returning();
    adminUserId = admin!.id;
  });

  it("handles valid staff invitation creation, token retrieval, and single-use account activation", async () => {
    const inviteToken = `token-valid-${Date.now()}`;
    const inviteEmail = `newstaff-${Date.now()}@example.test`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    // Insert invitation with SHA-256 hashed token
    await db.insert(schema.staffInvitations).values({
      storeId,
      email: inviteEmail,
      role: "staff",
      token: hashInviteToken(inviteToken),
      invitedBy: ownerUserId,
      expiresAt,
    });

    // 1. Retrieve invite details
    const check = await getStaffInviteAction(inviteToken);
    expect(check.valid).toBe(true);
    expect(check.email).toBe(inviteEmail);
    expect(check.role).toBe("staff");

    // 2. Accept invite: sets name and self-chosen password
    const acceptResult = await acceptStaffInviteAction({
      token: inviteToken,
      name: "New Staff Member",
      password: "StrongPassword123!",
    });

    expect(acceptResult.success).toBe(true);
    expect(acceptResult.email).toBe(inviteEmail);

    // Verify user created with role 'staff' and emailVerified = true
    const [createdUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, inviteEmail))
      .limit(1);

    expect(createdUser).toBeDefined();
    expect(createdUser?.role).toBe("staff");
    expect(createdUser?.emailVerified).toBe(true);

    // Verify password account created
    const [account] = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, createdUser!.id))
      .limit(1);

    expect(account).toBeDefined();
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeDefined();

    // 3. Single-Use Protection: Second attempt to accept the same token must fail
    await expect(
      acceptStaffInviteAction({
        token: inviteToken,
        name: "Duplicate Attempt",
        password: "StrongPassword123!",
      }),
    ).rejects.toThrow("Undangan ini sudah digunakan");
  });

  it("prohibits activation when invitation token is expired", async () => {
    const expiredToken = `token-expired-${Date.now()}`;
    const expiredEmail = `expired-${Date.now()}@example.test`;
    const expiredDate = new Date(Date.now() - 1000 * 60); // 1 minute ago

    await db.insert(schema.staffInvitations).values({
      storeId,
      email: expiredEmail,
      role: "staff",
      token: hashInviteToken(expiredToken),
      invitedBy: ownerUserId,
      expiresAt: expiredDate,
    });

    // Check action rejects expired
    const check = await getStaffInviteAction(expiredToken);
    expect(check.valid).toBe(false);
    expect(check.error).toContain("Undangan telah kedaluwarsa");

    // Accept action throws
    await expect(
      acceptStaffInviteAction({
        token: expiredToken,
        name: "Expired Candidate",
        password: "StrongPassword123!",
      }),
    ).rejects.toThrow("Undangan telah kedaluwarsa");
  });

  it("enforces last-owner governance: cannot demote the only remaining store owner", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: { id: ownerUserId, email: "owner@test.com", role: "owner" },
        targetUserId: ownerUserId,
        targetUserRole: "owner",
        newRole: "staff",
        ownerCount: 1, // Only 1 owner remains
      }),
    ).toThrow("Security restriction: You cannot modify your own administrative role");

    // Another admin attempting to demote last owner
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: { id: adminUserId, email: "admin@test.com", role: "admin" },
        targetUserId: ownerUserId,
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 1,
      }),
    ).toThrow("Permission denied: Admins cannot modify, demote, or disable store owners");
  });

  it("enforces shared password policy (min 12 chars, upper, lower, number, symbol) on acceptance", async () => {
    const inviteToken = `token-policy-${Date.now()}`;
    const inviteEmail = `weakpass-${Date.now()}@example.test`;

    await db.insert(schema.staffInvitations).values({
      storeId,
      email: inviteEmail,
      role: "staff",
      token: hashInviteToken(inviteToken),
      invitedBy: ownerUserId,
      expiresAt: new Date(Date.now() + 3600000),
    });

    // Too short (<12 chars)
    await expect(
      acceptStaffInviteAction({
        token: inviteToken,
        name: "Policy Tester",
        password: "Short1!",
      }),
    ).rejects.toThrow("Password must be at least 12 characters in length.");

    // Missing symbol
    await expect(
      acceptStaffInviteAction({
        token: inviteToken,
        name: "Policy Tester",
        password: "NoSymbolPassword1234",
      }),
    ).rejects.toThrow("Password must contain at least one special character or symbol.");
  });

  it("strictly rejects invitation acceptance if target email already has an account (customer), preventing silent elevation or password overwrite", async () => {
    const existingEmail = `existing-cust-${Date.now()}@example.test`;
    const initialPassword = "CustomerOriginalPassword123!";
    const [existingCust] = await db
      .insert(schema.user)
      .values({
        id: `usr-exist-${Date.now()}`,
        name: "Existing Customer",
        email: existingEmail,
        role: "customer",
        emailVerified: true,
      })
      .returning();

    // Insert original credential account
    const originalHashedPassword = await hashPassword(initialPassword);
    await db.insert(schema.account).values({
      id: `acc-exist-${Date.now()}`,
      userId: existingCust!.id,
      accountId: existingCust!.id,
      providerId: "credential",
      password: originalHashedPassword,
    });

    const inviteToken = `token-exist-${Date.now()}`;
    await db.insert(schema.staffInvitations).values({
      storeId,
      email: existingEmail,
      role: "staff",
      token: hashInviteToken(inviteToken),
      invitedBy: ownerUserId,
      expiresAt: new Date(Date.now() + 3600000),
    });

    // Accepting invite for existing customer must fail
    await expect(
      acceptStaffInviteAction({
        token: inviteToken,
        name: "Malicious Takeover Attempt",
        password: "AttackerNewPassword2026!",
      }),
    ).rejects.toThrow(/sudah terdaftar \(customer\)/);

    // Verify user role is unchanged (still 'customer')
    const [userAfter] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, existingCust!.id))
      .limit(1);
    expect(userAfter?.role).toBe("customer");

    // Verify password is NOT overwritten
    const [accountAfter] = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, existingCust!.id))
      .limit(1);
    expect(accountAfter?.password).toBe(originalHashedPassword);
  });

  it("strictly rejects invitation acceptance if target email already belongs to staff or admin", async () => {
    const existingStaffEmail = `existing-staff-${Date.now()}@example.test`;
    await db.insert(schema.user).values({
      id: `usr-ex-staff-${Date.now()}`,
      name: "Existing Staff User",
      email: existingStaffEmail,
      role: "staff",
      emailVerified: true,
    });

    const inviteToken = `token-staff-elev-${Date.now()}`;
    await db.insert(schema.staffInvitations).values({
      storeId,
      email: existingStaffEmail,
      role: "admin",
      token: hashInviteToken(inviteToken),
      invitedBy: ownerUserId,
      expiresAt: new Date(Date.now() + 3600000),
    });

    await expect(
      acceptStaffInviteAction({
        token: inviteToken,
        name: "Staff Elevation Attempt",
        password: "NewAdminPassword2026!",
      }),
    ).rejects.toThrow(/sudah terdaftar \(staff\)/);
  });

  it("safely rejects invitation acceptance if target email belongs to store owner", async () => {
    const ownerEmail = `existing-owner-${Date.now()}@example.test`;
    await db.insert(schema.user).values({
      id: `usr-ex-owner-${Date.now()}`,
      name: "Store Owner User",
      email: ownerEmail,
      role: "owner",
      emailVerified: true,
    });

    const inviteToken = `token-owner-${Date.now()}`;
    await db.insert(schema.staffInvitations).values({
      storeId,
      email: ownerEmail,
      role: "staff",
      token: hashInviteToken(inviteToken),
      invitedBy: ownerUserId,
      expiresAt: new Date(Date.now() + 3600000),
    });

    await expect(
      acceptStaffInviteAction({
        token: inviteToken,
        name: "Owner Demote Attempt",
        password: "NewStaffPassword2026!",
      }),
    ).rejects.toThrow("Akun pemilik toko (owner) tidak dapat diubah melalui undangan");
  });

  it("enforces self-role governance: user cannot change their own administrative role", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: { id: adminUserId, email: "admin@test.com", role: "admin" },
        targetUserId: adminUserId,
        targetUserRole: "admin",
        newRole: "owner",
        ownerCount: 2,
      }),
    ).toThrow("Security restriction: You cannot modify your own administrative role");
  });
});
