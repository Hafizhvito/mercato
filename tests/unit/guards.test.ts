import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertRole,
  assertStoreAccess,
  type SessionUser,
} from "../../src/server/guards";

describe("Server role and store access guards", () => {
  it("allows users with matching or higher roles", () => {
    const adminUser: SessionUser = {
      id: "u1",
      email: "admin@mercato.local",
      role: "admin",
    };

    expect(() => assertRole(adminUser, "customer")).not.toThrow();
    expect(() => assertRole(adminUser, "staff")).not.toThrow();
    expect(() => assertRole(adminUser, "admin")).not.toThrow();
  });

  it("throws AuthorizationError when role is insufficient", () => {
    const customerUser: SessionUser = {
      id: "u2",
      email: "customer@example.com",
      role: "customer",
    };

    expect(() => assertRole(customerUser, "admin")).toThrow(AuthorizationError);
  });

  it("throws when user session is null or undefined", () => {
    expect(() => assertRole(null, "customer")).toThrow(AuthorizationError);
  });

  it("enforces tenant store isolation", () => {
    const staffUser: SessionUser = {
      id: "u3",
      email: "staff@store1.com",
      role: "staff",
      storeId: "store-alpha",
    };

    expect(() => assertStoreAccess(staffUser, "store-alpha")).not.toThrow();
    expect(() => assertStoreAccess(staffUser, "store-beta")).toThrow(AuthorizationError);
  });

  it("permits owners to access any store context", () => {
    const ownerUser: SessionUser = {
      id: "u4",
      email: "owner@mercato.local",
      role: "owner",
    };

    expect(() => assertStoreAccess(ownerUser, "store-arbitrary")).not.toThrow();
  });
});
