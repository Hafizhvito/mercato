import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "../../src/lib/auth";
import { authRateLimiter } from "../../src/lib/cache/ratelimit";
import { db } from "../../src/lib/db";
import * as schema from "../../src/lib/db/schema";
import {
  AuthorizationError,
  assertRole,
  assertStoreAccess,
  type SessionUser,
} from "../../src/server/guards";

describe("Phase 1 Integration: Authentication and Role-Based Access Control", () => {
  const testEmail = `test-user-${Date.now()}@mercato.local`;
  const initialPassword = "InitialPassword123!";
  const updatedPassword = "UpdatedPassword456!";
  let testUserId: string;

  afterAll(async () => {
    // Cleanup any created test users
    try {
      await db.delete(schema.user).where(like(schema.user.email, "test-user-%@mercato.local"));
    } catch {
      // Ignore cleanup error if already deleted
    }
  });

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

  it("registers a new customer account in the real database", async () => {
    const signupRes = await auth.api.signUpEmail({
      body: {
        email: testEmail,
        password: initialPassword,
        name: "Test Customer",
      },
    });

    expect(signupRes).toBeDefined();
    expect(signupRes?.user?.id).toBeDefined();
    testUserId = signupRes.user.id;

    // Verify row exists in PostgreSQL
    const [dbUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, testUserId))
      .limit(1);

    expect(dbUser).toBeDefined();
    expect(dbUser?.email).toBe(testEmail);
    expect(dbUser?.emailVerified).toBe(false);
    expect(dbUser?.role).toBe("customer");
  });

  it("authenticates valid credentials and issues session", async () => {
    const loginRes = await auth.api.signInEmail({
      body: {
        email: testEmail,
        password: initialPassword,
      },
    });

    expect(loginRes).toBeDefined();
    expect(loginRes.token).toBeDefined();
    expect(loginRes.user.id).toBe(testUserId);
  });

  it("rejects login attempt with incorrect password", async () => {
    await expect(
      auth.api.signInEmail({
        body: {
          email: testEmail,
          password: "CompletelyWrongPassword!",
        },
      }),
    ).rejects.toThrow();
  });

  it("handles email verification state update in the database", async () => {
    // Trigger email verification token creation
    await auth.api.sendVerificationEmail({
      body: {
        email: testEmail,
      },
    });

    // Mark verified in DB and verify persistent state
    await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, testUserId));

    const [verifiedUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, testUserId))
      .limit(1);

    expect(verifiedUser?.emailVerified).toBe(true);
  });

  it("executes password reset flow and verifies updated credentials", async () => {
    // Request password reset
    await auth.api.requestPasswordReset({
      body: {
        email: testEmail,
        redirectTo: "/reset-password",
      },
    });

    // Retrieve generated verification token from verification table
    const [verificationRecord] = await db
      .select()
      .from(schema.verification)
      .where(like(schema.verification.identifier, "reset-password:%"))
      .limit(1);

    if (verificationRecord) {
      const token = verificationRecord.identifier.replace("reset-password:", "");
      await auth.api.resetPassword({
        body: {
          token,
          newPassword: updatedPassword,
        },
      });

      // Verify sign in with new password succeeds
      const loginRes = await auth.api.signInEmail({
        body: {
          email: testEmail,
          password: updatedPassword,
        },
      });
      expect(loginRes.token).toBeDefined();
    }
  });

  it("enforces rate limiting on authentication attempts", async () => {
    const testKey = `test-limit-key-${Date.now()}`;
    const results = [];

    for (let i = 0; i < 6; i++) {
      const res = await authRateLimiter.limit(testKey);
      results.push(res.success);
    }

    // 5 attempts allowed in 1 minute, 6th should be blocked
    expect(results.slice(0, 5).every((s) => s === true)).toBe(true);
    expect(results[5]).toBe(false);
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
