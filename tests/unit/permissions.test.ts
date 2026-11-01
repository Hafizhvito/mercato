import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
  AuthorizationError,
  assertPermission,
  assertStaffModificationAllowed,
  hasPermission,
  type SessionUser,
} from "@/server/guards";

describe("Section B: Single Source of Truth Permission Matrix Unit Tests", () => {
  const customerUser: SessionUser = { id: "u-cust", email: "cust@mercato.local", role: "customer" };
  const staffUser: SessionUser = {
    id: "u-staff",
    email: "staff@mercato.local",
    role: "staff",
    storeId: "store-1",
  };
  const adminUser: SessionUser = {
    id: "u-admin",
    email: "admin@mercato.local",
    role: "admin",
    storeId: "store-1",
  };
  const ownerUser: SessionUser = {
    id: "u-owner",
    email: "owner@mercato.local",
    role: "owner",
    storeId: "store-1",
  };

  it("denies all administrative permissions to customer role", () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(hasPermission("customer", permission)).toBe(false);
      expect(() => assertPermission(customerUser, permission)).toThrow(AuthorizationError);
    }
  });

  it("verifies staff role permissions: products, inventory, orders, read-only customers", () => {
    const permittedStaffActions: AdminPermission[] = [
      "products:view",
      "products:manage",
      "inventory:view",
      "inventory:adjust",
      "orders:view",
      "orders:fulfill",
      "orders:notes",
      "orders:cancel_unpaid",
      "customers:view",
    ];

    for (const action of permittedStaffActions) {
      expect(hasPermission("staff", action)).toBe(true);
      expect(() => assertPermission(staffUser, action)).not.toThrow();
    }

    const prohibitedStaffActions: AdminPermission[] = [
      "orders:refund",
      "orders:export",
      "customers:manage",
      "discounts:view",
      "discounts:manage",
      "analytics:view",
      "settings:view",
      "settings:manage",
      "staff:view",
      "staff:manage",
      "owner:transfer",
      "audit_log:view",
    ];

    for (const action of prohibitedStaffActions) {
      expect(hasPermission("staff", action)).toBe(false);
      expect(() => assertPermission(staffUser, action)).toThrow(AuthorizationError);
    }
  });

  it("verifies admin role permissions: all operations except owner transfer / modifying owners", () => {
    for (const action of ADMIN_PERMISSIONS) {
      if (action === "owner:transfer") {
        expect(hasPermission("admin", action)).toBe(false);
        expect(() => assertPermission(adminUser, action)).toThrow(AuthorizationError);
      } else {
        expect(hasPermission("admin", action)).toBe(true);
        expect(() => assertPermission(adminUser, action)).not.toThrow();
      }
    }
  });

  it("verifies owner role permissions: full authority across all domains", () => {
    for (const action of ADMIN_PERMISSIONS) {
      expect(hasPermission("owner", action)).toBe(true);
      expect(() => assertPermission(ownerUser, action)).not.toThrow();
    }
  });

  it("enforces staff governance rules: self-modification is prohibited", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: adminUser,
        targetUserId: adminUser.id,
        targetUserRole: "admin",
        newRole: "staff",
        ownerCount: 1,
      }),
    ).toThrow(/cannot modify your own administrative role/);
  });

  it("enforces staff governance rules: admins cannot modify or elevate to owner", () => {
    // Admin attempting to demote an owner
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: adminUser,
        targetUserId: "u-owner-2",
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 2,
      }),
    ).toThrow(/Admins cannot modify, demote, or disable store owners/);

    // Admin attempting to elevate staff to owner
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: adminUser,
        targetUserId: "u-staff-2",
        targetUserRole: "staff",
        newRole: "owner",
        ownerCount: 1,
      }),
    ).toThrow(/Only store owners can elevate accounts to the owner role/);
  });

  it("enforces staff governance rules: last owner cannot be demoted or disabled", () => {
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: ownerUser,
        targetUserId: ownerUser.id === "u-owner" ? "u-other-owner" : "u-owner",
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 1,
      }),
    ).toThrow(/The last store owner cannot be demoted or removed/);
  });

  it("permits valid staff governance operations by authorized actors", () => {
    // Owner elevates admin to owner when multiple owners exist
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: ownerUser,
        targetUserId: "u-admin",
        targetUserRole: "admin",
        newRole: "owner",
        ownerCount: 1,
      }),
    ).not.toThrow();

    // Admin changes staff role to customer/disabled
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: adminUser,
        targetUserId: "u-staff-2",
        targetUserRole: "staff",
        newRole: "customer",
        ownerCount: 1,
      }),
    ).not.toThrow();

    // Owner demotes an owner when there are 2 owners
    expect(() =>
      assertStaffModificationAllowed({
        currentUser: ownerUser,
        targetUserId: "u-owner-2",
        targetUserRole: "owner",
        newRole: "admin",
        ownerCount: 2,
      }),
    ).not.toThrow();
  });
});
