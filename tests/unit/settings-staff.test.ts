import { describe, expect, it } from "vitest";
import { assertStaffModificationAllowed, hasPermission } from "@/server/guards";

describe("Staff Management & Team Governance Unit Tests", () => {
  const mockOwnerUser = {
    id: "usr-owner-1",
    name: "Owner 1",
    email: "owner1@mercato.local",
    role: "owner" as const,
  };

  const mockAdminUser = {
    id: "usr-admin-1",
    name: "Admin 1",
    email: "admin1@mercato.local",
    role: "admin" as const,
  };

  const mockStaffUser = {
    id: "usr-staff-1",
    name: "Staff 1",
    email: "staff1@mercato.local",
    role: "staff" as const,
  };

  it("prohibits a user from modifying their own administrative role", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: mockAdminUser,
        targetUserId: mockAdminUser.id,
        targetUserRole: "admin",
        newRole: "staff",
        ownerCount: 1,
      }),
    ).toThrow("Security restriction: You cannot modify your own administrative role");
  });

  it("prohibits admins from altering or demoting store owners", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: mockAdminUser,
        targetUserId: mockOwnerUser.id,
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 1,
      }),
    ).toThrow("Permission denied: Admins cannot modify, demote, or disable store owners");
  });

  it("prohibits admins from elevating staff to the owner role", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: mockAdminUser,
        targetUserId: mockStaffUser.id,
        targetUserRole: "staff",
        newRole: "owner",
        ownerCount: 1,
      }),
    ).toThrow("Permission denied: Only store owners can elevate accounts to the owner role");
  });

  it("prohibits demoting the sole/last store owner", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: mockOwnerUser,
        targetUserId: "usr-other-owner",
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 1, // Only 1 owner exists
      }),
    ).toThrow("Security restriction: The last store owner cannot be demoted or removed");
  });

  it("allows owner to demote another owner when multiple owners exist", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: mockOwnerUser,
        targetUserId: "usr-other-owner",
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 2, // 2 owners exist
      }),
    ).not.toThrow();
  });

  it("allows admin to promote staff to admin", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: mockAdminUser,
        targetUserId: mockStaffUser.id,
        targetUserRole: "staff",
        newRole: "admin",
        ownerCount: 1,
      }),
    ).not.toThrow();
  });
});

describe("Settings & Audit Log Permissions", () => {
  it("strictly bars staff from viewing or managing settings and audit logs", () => {
    expect(hasPermission("staff", "settings:view")).toBe(false);
    expect(hasPermission("staff", "settings:manage")).toBe(false);
    expect(hasPermission("staff", "staff:manage")).toBe(false);
    expect(hasPermission("staff", "audit_log:view")).toBe(false);
  });

  it("grants admin settings, staff management, and audit log permissions", () => {
    expect(hasPermission("admin", "settings:view")).toBe(true);
    expect(hasPermission("admin", "settings:manage")).toBe(true);
    expect(hasPermission("admin", "staff:manage")).toBe(true);
    expect(hasPermission("admin", "audit_log:view")).toBe(true);
    expect(hasPermission("admin", "owner:transfer")).toBe(false); // Admin cannot transfer ownership
  });

  it("grants owner all settings, audit log, and owner transfer permissions", () => {
    expect(hasPermission("owner", "settings:view")).toBe(true);
    expect(hasPermission("owner", "settings:manage")).toBe(true);
    expect(hasPermission("owner", "staff:manage")).toBe(true);
    expect(hasPermission("owner", "audit_log:view")).toBe(true);
    expect(hasPermission("owner", "owner:transfer")).toBe(true);
  });
});
