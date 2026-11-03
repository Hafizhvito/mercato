import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { orderService } from "@/modules/orders/service";
import { assertPermission, type SessionUser } from "@/server/guards";

describe("Phase 5: Comprehensive Role-Based Authorization & Multi-Tenant IDOR Matrix", () => {
  let storeAId: string;
  let storeBId: string;

  let ownerUser: SessionUser;
  let adminUser: SessionUser;
  let staffUser: SessionUser;
  let customerUser: SessionUser;
  let _foreignStaffUser: SessionUser;

  let storeAOrderId: string;
  let storeAOrderNumber: string;
  let storeAGuestToken: string;

  let _storeBOrderId: string;
  let storeBOrderNumber: string;

  beforeAll(async () => {
    // 1. Provision Store A & Store B (Multi-tenant foundation)
    const [storeA] = await db
      .insert(schema.stores)
      .values({
        name: "Store Alpha",
        slug: `store-alpha-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeAId = storeA!.id;

    const [storeB] = await db
      .insert(schema.stores)
      .values({
        name: "Store Beta",
        slug: `store-beta-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeBId = storeB!.id;

    // 2. Provision Users for Store A
    const [uOwner] = await db
      .insert(schema.user)
      .values({
        id: `usr-mat-owner-${Date.now()}`,
        name: "Alpha Owner",
        email: `alpha.owner-${Date.now()}@example.test`,
        role: "owner",
        emailVerified: true,
      })
      .returning();
    ownerUser = { id: uOwner!.id, email: uOwner!.email, role: "owner" };

    const [uAdmin] = await db
      .insert(schema.user)
      .values({
        id: `usr-mat-admin-${Date.now()}`,
        name: "Alpha Admin",
        email: `alpha.admin-${Date.now()}@example.test`,
        role: "admin",
        emailVerified: true,
      })
      .returning();
    adminUser = { id: uAdmin!.id, email: uAdmin!.email, role: "admin" };

    const [uStaff] = await db
      .insert(schema.user)
      .values({
        id: `usr-mat-staff-${Date.now()}`,
        name: "Alpha Staff",
        email: `alpha.staff-${Date.now()}@example.test`,
        role: "staff",
        emailVerified: true,
      })
      .returning();
    staffUser = { id: uStaff!.id, email: uStaff!.email, role: "staff" };

    const [uCust] = await db
      .insert(schema.user)
      .values({
        id: `usr-mat-cust-${Date.now()}`,
        name: "Alpha Customer",
        email: `alpha.cust-${Date.now()}@example.test`,
        role: "customer",
        emailVerified: true,
      })
      .returning();
    customerUser = { id: uCust!.id, email: uCust!.email, role: "customer" };

    // 3. Provision Foreign Staff belonging to Store B
    const [uForeignStaff] = await db
      .insert(schema.user)
      .values({
        id: `usr-foreign-staff-${Date.now()}`,
        name: "Beta Staff",
        email: `beta.staff-${Date.now()}@example.test`,
        role: "staff",
        emailVerified: true,
      })
      .returning();
    _foreignStaffUser = {
      id: uForeignStaff!.id,
      email: uForeignStaff!.email,
      role: "staff",
    };

    const defaultAddress = {
      recipientName: "Test Recipient",
      phone: "081234567890",
      street: "Jl. Sudirman No. 1",
      district: "Menteng",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postalCode: "10310",
      country: "Indonesia",
    };

    // 4. Provision Orders in Store A and Store B
    storeAGuestToken = `guest-token-${Date.now()}`;
    const [orderA] = await db
      .insert(schema.orders)
      .values({
        storeId: storeAId,
        orderNumber: `ORD-ALPHA-${Date.now()}`,
        customerId: customerUser.id,
        guestAccessToken: storeAGuestToken,
        idempotencyKey: `idem-alpha-${Date.now()}`,
        checkoutSessionId: `sess-alpha-${Date.now()}`,
        status: "paid",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 100000,
        shippingAmount: 15000,
        totalAmount: 115000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: defaultAddress,
      })
      .returning();
    storeAOrderId = orderA!.id;
    storeAOrderNumber = orderA!.orderNumber;

    const [orderB] = await db
      .insert(schema.orders)
      .values({
        storeId: storeBId,
        orderNumber: `ORD-BETA-${Date.now()}`,
        customerId: null,
        guestAccessToken: `token-b-${Date.now()}`,
        idempotencyKey: `idem-alpha-${Date.now()}`,
        checkoutSessionId: `sess-alpha-${Date.now()}`,
        status: "paid",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 200000,
        shippingAmount: 20000,
        totalAmount: 220000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: defaultAddress,
      })
      .returning();
    _storeBOrderId = orderB!.id;
    storeBOrderNumber = orderB!.orderNumber;
  });

  describe("A. Role Permissions Gate Matrix across All 5 Roles", () => {
    it("strictly blocks anonymous visitors from all administrative actions", () => {
      const anonUser: SessionUser | null = null;
      expect(() => assertPermission(anonUser, "orders:view")).toThrow(
        "Authentication required: No active session found",
      );
      expect(() => assertPermission(anonUser, "inventory:adjust")).toThrow(
        "Authentication required",
      );
      expect(() => assertPermission(anonUser, "orders:refund")).toThrow("Authentication required");
      expect(() => assertPermission(anonUser, "settings:manage")).toThrow(
        "Authentication required",
      );
    });

    it("strictly blocks customer role from all back-office administrative actions", () => {
      expect(() => assertPermission(customerUser, "orders:view")).toThrow(
        "Permission denied: Role 'customer' lacks required permission 'orders:view'",
      );
      expect(() => assertPermission(customerUser, "orders:fulfill")).toThrow("Permission denied");
      expect(() => assertPermission(customerUser, "orders:refund")).toThrow("Permission denied");
      expect(() => assertPermission(customerUser, "inventory:adjust")).toThrow("Permission denied");
      expect(() => assertPermission(customerUser, "discounts:manage")).toThrow("Permission denied");
      expect(() => assertPermission(customerUser, "settings:manage")).toThrow("Permission denied");
      expect(() => assertPermission(customerUser, "audit_log:view")).toThrow("Permission denied");
    });

    it("permits staff for fulfillment, notes, cancel unpaid, and inventory, but blocks refunds, discounts, settings, and exports", () => {
      // Allowed operations for staff
      expect(() => assertPermission(staffUser, "orders:view")).not.toThrow();
      expect(() => assertPermission(staffUser, "orders:fulfill")).not.toThrow();
      expect(() => assertPermission(staffUser, "orders:notes")).not.toThrow();
      expect(() => assertPermission(staffUser, "orders:cancel_unpaid")).not.toThrow();
      expect(() => assertPermission(staffUser, "inventory:view")).not.toThrow();
      expect(() => assertPermission(staffUser, "inventory:adjust")).not.toThrow();
      expect(() => assertPermission(staffUser, "customers:view")).not.toThrow();

      // Blocked operations for staff
      expect(() => assertPermission(staffUser, "orders:refund")).toThrow("Permission denied");
      expect(() => assertPermission(staffUser, "orders:export")).toThrow("Permission denied");
      expect(() => assertPermission(staffUser, "discounts:manage")).toThrow("Permission denied");
      expect(() => assertPermission(staffUser, "settings:manage")).toThrow("Permission denied");
      expect(() => assertPermission(staffUser, "staff:manage")).toThrow("Permission denied");
      expect(() => assertPermission(staffUser, "analytics:view")).toThrow("Permission denied");
      expect(() => assertPermission(staffUser, "audit_log:view")).toThrow("Permission denied");
    });

    it("permits admin for all operational actions including refunds, discounts, and exports, but blocks owner transfer", () => {
      expect(() => assertPermission(adminUser, "orders:view")).not.toThrow();
      expect(() => assertPermission(adminUser, "orders:fulfill")).not.toThrow();
      expect(() => assertPermission(adminUser, "orders:refund")).not.toThrow();
      expect(() => assertPermission(adminUser, "orders:export")).not.toThrow();
      expect(() => assertPermission(adminUser, "discounts:manage")).not.toThrow();
      expect(() => assertPermission(adminUser, "settings:manage")).not.toThrow();
      expect(() => assertPermission(adminUser, "analytics:view")).not.toThrow();
      expect(() => assertPermission(adminUser, "audit_log:view")).not.toThrow();

      // Admin blocked from owner transfer
      expect(() => assertPermission(adminUser, "owner:transfer")).toThrow("Permission denied");
    });

    it("permits owner full authority across all administrative domains including owner transfer", () => {
      expect(() => assertPermission(ownerUser, "orders:refund")).not.toThrow();
      expect(() => assertPermission(ownerUser, "orders:export")).not.toThrow();
      expect(() => assertPermission(ownerUser, "staff:manage")).not.toThrow();
      expect(() => assertPermission(ownerUser, "owner:transfer")).not.toThrow();
      expect(() => assertPermission(ownerUser, "audit_log:view")).not.toThrow();
    });
  });

  describe("B. Multi-Tenant Isolation & IDOR Access Prevention", () => {
    it("prevents IDOR access: Customer cannot access orders belonging to other customers", async () => {
      const foreignCustomer: SessionUser = {
        id: `usr-attacker-${Date.now()}`,
        email: "attacker@example.test",
        role: "customer",
      };

      const accessResult = await orderService.verifyOrderAccess({
        orderNumber: storeAOrderNumber,
        storeId: storeAId,
        userId: foreignCustomer.id,
        userRole: foreignCustomer.role,
        token: null, // No guest token supplied
      });

      expect(accessResult.authorized).toBe(false);
      expect(accessResult.reason).toBe("UNAUTHORIZED");
    });

    it("permits owner of the order to access their own order without guest token", async () => {
      const accessResult = await orderService.verifyOrderAccess({
        orderNumber: storeAOrderNumber,
        storeId: storeAId,
        userId: customerUser.id,
        userRole: customerUser.role,
        token: null,
      });

      expect(accessResult.authorized).toBe(true);
      expect(accessResult.order?.id).toBe(storeAOrderId);
    });

    it("permits guest access when presenting matching guestAccessToken", async () => {
      const accessResult = await orderService.verifyOrderAccess({
        orderNumber: storeAOrderNumber,
        storeId: storeAId,
        userId: null,
        userRole: null,
        token: storeAGuestToken,
      });

      expect(accessResult.authorized).toBe(true);
      expect(accessResult.order?.id).toBe(storeAOrderId);
    });

    it("rejects guest access when presenting invalid guestAccessToken", async () => {
      const accessResult = await orderService.verifyOrderAccess({
        orderNumber: storeAOrderNumber,
        storeId: storeAId,
        userId: null,
        userRole: null,
        token: "forged-guest-token",
      });

      expect(accessResult.authorized).toBe(false);
    });

    it("enforces tenant isolation: orders from Store B cannot be resolved under Store A context", async () => {
      const accessResult = await orderService.verifyOrderAccess({
        orderNumber: storeBOrderNumber,
        storeId: storeAId, // Attempting to read Store B's order inside Store A
        userId: ownerUser.id,
        userRole: ownerUser.role,
        token: null,
      });

      expect(accessResult.authorized).toBe(false);
      expect(accessResult.reason).toBe("NOT_FOUND");
    });
  });
});
