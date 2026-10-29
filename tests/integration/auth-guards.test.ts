import { describe, expect, it } from "vitest";
import { auth } from "../../src/lib/auth";
import * as schema from "../../src/lib/db/schema";
import {
  AuthorizationError,
  assertRole,
  assertStoreAccess,
  type SessionUser,
} from "../../src/server/guards";

describe("Phase 1 Integration: Authentication and Role-Based Access Control", () => {
  it("verifies Better Auth instance is properly initialized with required plugins", () => {
    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
    expect(typeof auth.handler).toBe("function");
  });

  it("verifies Drizzle schema definition includes required auth and tenant tables", () => {
    expect(schema.stores).toBeDefined();
    expect(schema.user).toBeDefined();
    expect(schema.session).toBeDefined();
    expect(schema.account).toBeDefined();
    expect(schema.verification).toBeDefined();
    expect(schema.twoFactor).toBeDefined();
    expect(schema.auditLogs).toBeDefined();
  });

  it("validates role permissions hierarchy: customer < staff < admin < owner", () => {
    const customerUser: SessionUser = {
      id: "cust-1",
      email: "cust@mercato.local",
      role: "customer",
    };
    const staffUser: SessionUser = {
      id: "staff-1",
      email: "staff@mercato.local",
      role: "staff",
    };
    const adminUser: SessionUser = {
      id: "admin-1",
      email: "admin@mercato.local",
      role: "admin",
    };
    const ownerUser: SessionUser = {
      id: "owner-1",
      email: "owner@mercato.local",
      role: "owner",
    };

    // Customer can only satisfy customer requirement
    expect(() => assertRole(customerUser, "customer")).not.toThrow();
    expect(() => assertRole(customerUser, "staff")).toThrow(AuthorizationError);
    expect(() => assertRole(customerUser, "admin")).toThrow(AuthorizationError);
    expect(() => assertRole(customerUser, "owner")).toThrow(AuthorizationError);

    // Staff can satisfy customer and staff requirements
    expect(() => assertRole(staffUser, "customer")).not.toThrow();
    expect(() => assertRole(staffUser, "staff")).not.toThrow();
    expect(() => assertRole(staffUser, "admin")).toThrow(AuthorizationError);
    expect(() => assertRole(staffUser, "owner")).toThrow(AuthorizationError);

    // Admin can satisfy customer, staff, and admin requirements
    expect(() => assertRole(adminUser, "customer")).not.toThrow();
    expect(() => assertRole(adminUser, "staff")).not.toThrow();
    expect(() => assertRole(adminUser, "admin")).not.toThrow();
    expect(() => assertRole(adminUser, "owner")).toThrow(AuthorizationError);

    // Owner can satisfy all requirements
    expect(() => assertRole(ownerUser, "customer")).not.toThrow();
    expect(() => assertRole(ownerUser, "staff")).not.toThrow();
    expect(() => assertRole(ownerUser, "admin")).not.toThrow();
    expect(() => assertRole(ownerUser, "owner")).not.toThrow();
  });

  it("enforces tenant boundary isolation between stores", () => {
    const staffStoreA: SessionUser = {
      id: "staff-a",
      email: "staff-a@store-a.local",
      role: "staff",
      storeId: "00000000-0000-0000-0000-000000000001",
    };

    // Can access own store
    expect(() =>
      assertStoreAccess(staffStoreA, "00000000-0000-0000-0000-000000000001"),
    ).not.toThrow();

    // Cannot access another store
    expect(() => assertStoreAccess(staffStoreA, "00000000-0000-0000-0000-000000000002")).toThrow(
      AuthorizationError,
    );

    // Owner can access any store
    const owner: SessionUser = {
      id: "owner-all",
      email: "owner@mercato.local",
      role: "owner",
    };
    expect(() => assertStoreAccess(owner, "00000000-0000-0000-0000-000000000002")).not.toThrow();
  });
});
