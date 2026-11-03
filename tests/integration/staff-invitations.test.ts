import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { acceptStaffInviteAction, getStaffInviteAction } from "@/modules/settings/actions";
import { assertStaffModificationAllowed } from "@/server/guards";

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

    // Insert invitation
    await db.insert(schema.staffInvitations).values({
      storeId,
      email: inviteEmail,
      role: "staff",
      token: inviteToken,
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
      token: expiredToken,
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
