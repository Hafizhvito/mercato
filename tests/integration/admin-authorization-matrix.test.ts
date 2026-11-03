import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { SessionUser } from "@/server/guards";

// Track current session across tests
let currentSessionUser: SessionUser | null = null;

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock next-intl/server
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

// Mock auth.api.getSession to return currentSessionUser
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    auth: {
      ...actual.auth,
      api: {
        ...actual.auth.api,
        getSession: vi.fn(async () => {
          if (!currentSessionUser) return null;
          return {
            user: {
              id: currentSessionUser.id,
              name: "Test Session User",
              email: currentSessionUser.email,
              role: currentSessionUser.role,
              storeId: currentSessionUser.storeId ?? null,
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            session: {
              id: `sess-${currentSessionUser.id}`,
              userId: currentSessionUser.id,
              expiresAt: new Date(Date.now() + 3600000),
            },
          };
        }),
      },
    },
  };
});

// Real Entry Points: Admin Page Loaders
import AdminAuditLogPage from "@/app/(admin)/admin/audit-log/page";
import AdminCustomerDetailPage from "@/app/(admin)/admin/customers/[id]/page";
import AdminCustomersPage from "@/app/(admin)/admin/customers/page";
import AdminDiscountsPage from "@/app/(admin)/admin/discounts/page";
import AdminInventoryPage from "@/app/(admin)/admin/inventory/page";
import AdminOrderDetailPage from "@/app/(admin)/admin/orders/[id]/page";
import AdminOrdersPage from "@/app/(admin)/admin/orders/page";
import AdminSettingsPage from "@/app/(admin)/admin/settings/page";
// Real Entry Points: Storefront Account Order Pages
import CustomerOrderDetailPage from "@/app/[locale]/account/orders/[orderNumber]/page";
import AccountOrdersPage from "@/app/[locale]/account/orders/page";
// Real Entry Points: Route Handler
import { GET as exportOrdersRouteHandler } from "@/app/api/admin/orders/export/route";

// Real Entry Points: Admin Server Actions
import { createDiscountAction } from "@/modules/discounts/actions";
import { adjustStockAction } from "@/modules/inventory/actions";
import { fulfillOrderAction } from "@/modules/orders/actions";
import { refundOrderAction } from "@/modules/payments/actions";
import { inviteStaffAction, updateStoreSettingsAction } from "@/modules/settings/actions";

function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (node.props?.children) return extractText(node.props.children);
  return "";
}

describe("Phase 5: Comprehensive Role-Based Authorization & Multi-Tenant IDOR Matrix", () => {
  let storeAId: string;
  let storeBId: string;

  let ownerUser: SessionUser;
  let adminUser: SessionUser;
  let staffUser: SessionUser;
  let customerUserA: SessionUser;
  let customerUserB: SessionUser;
  let foreignStaffUser: SessionUser;

  let storeAOrderId: string;
  let storeAOrderNumber: string;
  let _storeBOrderId: string;
  let _storeBOrderNumber: string;

  let testVariantId: string;

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

  beforeAll(async () => {
    // 1. Identify primary store as Store A, and create Store B for multi-tenant isolation
    const existingStore = await db.query.stores.findFirst();
    if (existingStore) {
      storeAId = existingStore.id;
    } else {
      const [storeA] = await db
        .insert(schema.stores)
        .values({
          name: "Store Alpha",
          slug: `store-alpha-${Date.now()}`,
          currency: "IDR",
          locale: "id",
          taxRatePercent: 11,
          taxInclusive: false,
        })
        .returning();
      storeAId = storeA!.id;
    }

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
    ownerUser = { id: uOwner!.id, email: uOwner!.email, role: "owner", storeId: storeAId };

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
    adminUser = { id: uAdmin!.id, email: uAdmin!.email, role: "admin", storeId: storeAId };

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
    staffUser = { id: uStaff!.id, email: uStaff!.email, role: "staff", storeId: storeAId };

    const [uCustA] = await db
      .insert(schema.user)
      .values({
        id: `usr-mat-custA-${Date.now()}`,
        name: "Alpha Customer A",
        email: `alpha.custA-${Date.now()}@example.test`,
        role: "customer",
        emailVerified: true,
      })
      .returning();
    customerUserA = { id: uCustA!.id, email: uCustA!.email, role: "customer" };

    const [uCustB] = await db
      .insert(schema.user)
      .values({
        id: `usr-mat-custB-${Date.now()}`,
        name: "Alpha Customer B",
        email: `alpha.custB-${Date.now()}@example.test`,
        role: "customer",
        emailVerified: true,
      })
      .returning();
    customerUserB = { id: uCustB!.id, email: uCustB!.email, role: "customer" };

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
    foreignStaffUser = {
      id: uForeignStaff!.id,
      email: uForeignStaff!.email,
      role: "staff",
      storeId: storeBId,
    };

    // 4. Provision Product & Variant in Store A
    const [prod] = await db
      .insert(schema.products)
      .values({
        storeId: storeAId,
        name: "Auth Test Product",
        slug: `auth-prod-${Date.now()}`,
        status: "published",
      })
      .returning();

    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        storeId: storeAId,
        productId: prod!.id,
        title: "Standard",
        sku: `AUTH-SKU-${Date.now()}`,
        price: 50000,
        stock: 100,
      })
      .returning();
    testVariantId = variant!.id;

    // 5. Provision Orders in Store A (owned by Customer A) and Store B
    const [orderA] = await db
      .insert(schema.orders)
      .values({
        storeId: storeAId,
        orderNumber: `ORD-ALPHA-${Date.now()}`,
        customerId: customerUserA.id,
        guestAccessToken: `guest-alpha-${Date.now()}`,
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
        idempotencyKey: `idem-beta-${Date.now()}`,
        checkoutSessionId: `sess-beta-${Date.now()}`,
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
    _storeBOrderNumber = orderB!.orderNumber;
  });

  describe("1. Real Entry Points: Admin Page Loaders Authorization", () => {
    it("AdminOrdersPage: anonymous redirected, customer denied, staff/admin/owner render successfully", async () => {
      // Anonymous -> Redirect
      currentSessionUser = null;
      await expect(AdminOrdersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
        "NEXT_REDIRECT:/login?callbackUrl=/admin/orders",
      );

      // Customer -> Denied (renders restriction div)
      currentSessionUser = customerUserA;
      const custView = await AdminOrdersPage({ searchParams: Promise.resolve({}) });
      expect(extractText(custView)).toContain("tidak memiliki izin untuk melihat daftar pesanan");

      // Staff -> Allowed
      currentSessionUser = staffUser;
      const staffView = await AdminOrdersPage({ searchParams: Promise.resolve({}) });
      expect(extractText(staffView)).not.toContain("tidak memiliki izin");

      // Admin & Owner -> Allowed
      currentSessionUser = adminUser;
      expect(
        extractText(await AdminOrdersPage({ searchParams: Promise.resolve({}) })),
      ).not.toContain("tidak memiliki izin");

      currentSessionUser = ownerUser;
      expect(
        extractText(await AdminOrdersPage({ searchParams: Promise.resolve({}) })),
      ).not.toContain("tidak memiliki izin");
    });

    it("AdminOrderDetailPage: anonymous redirected, customer denied, staff/admin/owner render, notFound on missing ID", async () => {
      currentSessionUser = null;
      await expect(
        AdminOrderDetailPage({ params: Promise.resolve({ id: storeAOrderId }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/login?callbackUrl=/admin/orders");

      currentSessionUser = customerUserA;
      const custView = await AdminOrderDetailPage({
        params: Promise.resolve({ id: storeAOrderId }),
      });
      expect(extractText(custView)).toContain(
        "tidak memiliki izin untuk melihat detail pesanan ini",
      );

      currentSessionUser = staffUser;
      const staffView = await AdminOrderDetailPage({
        params: Promise.resolve({ id: storeAOrderId }),
      });
      expect(extractText(staffView)).not.toContain("tidak memiliki izin");

      // Non-existent ID throws NEXT_NOT_FOUND
      currentSessionUser = ownerUser;
      await expect(
        AdminOrderDetailPage({
          params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("AdminCustomersPage: anonymous redirected, customer denied, staff/admin/owner render", async () => {
      currentSessionUser = null;
      await expect(AdminCustomersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
        "NEXT_REDIRECT:/login?callbackUrl=/admin/customers",
      );

      currentSessionUser = customerUserA;
      const custView = await AdminCustomersPage({ searchParams: Promise.resolve({}) });
      expect(extractText(custView)).toContain("tidak memiliki izin untuk melihat daftar pelanggan");

      currentSessionUser = staffUser;
      const staffView = await AdminCustomersPage({ searchParams: Promise.resolve({}) });
      expect(extractText(staffView)).not.toContain("tidak memiliki izin");
    });

    it("AdminCustomerDetailPage: anonymous redirected, customer denied, staff/admin/owner render, notFound on missing customer", async () => {
      currentSessionUser = null;
      await expect(
        AdminCustomerDetailPage({ params: Promise.resolve({ id: customerUserA.id }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/login?callbackUrl=/admin/customers");

      currentSessionUser = customerUserA;
      const custView = await AdminCustomerDetailPage({
        params: Promise.resolve({ id: customerUserA.id }),
      });
      expect(extractText(custView)).toContain(
        "tidak memiliki izin untuk melihat profil pelanggan ini",
      );

      currentSessionUser = staffUser;
      const staffView = await AdminCustomerDetailPage({
        params: Promise.resolve({ id: customerUserA.id }),
      });
      expect(extractText(staffView)).not.toContain("tidak memiliki izin");

      await expect(
        AdminCustomerDetailPage({ params: Promise.resolve({ id: "non-existent-cust-id" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("AdminInventoryPage: anonymous redirected, customer denied, staff/admin/owner render", async () => {
      currentSessionUser = null;
      await expect(AdminInventoryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
        "NEXT_REDIRECT:/login?callbackUrl=/admin/inventory",
      );

      currentSessionUser = customerUserA;
      const custView = await AdminInventoryPage({ searchParams: Promise.resolve({}) });
      expect(extractText(custView)).toContain(
        "tidak memiliki izin untuk melihat manajemen inventaris toko",
      );

      currentSessionUser = staffUser;
      const staffView = await AdminInventoryPage({ searchParams: Promise.resolve({}) });
      expect(extractText(staffView)).not.toContain("tidak memiliki izin");
    });

    it("AdminDiscountsPage: anonymous redirected, customer & staff denied, admin & owner render", async () => {
      currentSessionUser = null;
      await expect(AdminDiscountsPage()).rejects.toThrow(
        "NEXT_REDIRECT:/login?callbackUrl=/admin/discounts",
      );

      currentSessionUser = customerUserA;
      expect(extractText(await AdminDiscountsPage())).toContain("tidak memiliki izin");

      currentSessionUser = staffUser;
      expect(extractText(await AdminDiscountsPage())).toContain("tidak memiliki izin");

      currentSessionUser = adminUser;
      expect(extractText(await AdminDiscountsPage())).not.toContain("tidak memiliki izin");

      currentSessionUser = ownerUser;
      expect(extractText(await AdminDiscountsPage())).not.toContain("tidak memiliki izin");
    });

    it("AdminSettingsPage: anonymous redirected, customer & staff denied, admin & owner render", async () => {
      currentSessionUser = null;
      await expect(AdminSettingsPage()).rejects.toThrow(
        "NEXT_REDIRECT:/login?callbackUrl=/admin/settings",
      );

      currentSessionUser = customerUserA;
      expect(extractText(await AdminSettingsPage())).toContain("tidak memiliki izin");

      currentSessionUser = staffUser;
      expect(extractText(await AdminSettingsPage())).toContain("tidak memiliki izin");

      currentSessionUser = adminUser;
      expect(extractText(await AdminSettingsPage())).not.toContain("tidak memiliki izin");
    });

    it("AdminAuditLogPage: anonymous redirected, customer & staff denied, admin & owner render", async () => {
      currentSessionUser = null;
      await expect(AdminAuditLogPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
        "NEXT_REDIRECT:/login?callbackUrl=/admin/audit-log",
      );

      currentSessionUser = customerUserA;
      expect(extractText(await AdminAuditLogPage({ searchParams: Promise.resolve({}) }))).toContain(
        "tidak memiliki izin",
      );

      currentSessionUser = staffUser;
      expect(extractText(await AdminAuditLogPage({ searchParams: Promise.resolve({}) }))).toContain(
        "tidak memiliki izin",
      );

      currentSessionUser = adminUser;
      expect(
        extractText(await AdminAuditLogPage({ searchParams: Promise.resolve({}) })),
      ).not.toContain("tidak memiliki izin");
    });
  });

  describe("2. Real Entry Points: Route Handler /api/admin/orders/export", () => {
    it("returns 401 for anonymous, 403 for customer, 403 for staff, 200 CSV for admin and owner", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/orders/export");

      // Anonymous -> 401
      currentSessionUser = null;
      const resAnon = await exportOrdersRouteHandler(req);
      expect(resAnon.status).toBe(401);

      // Customer -> 403
      currentSessionUser = customerUserA;
      const resCust = await exportOrdersRouteHandler(req);
      expect(resCust.status).toBe(403);

      // Staff -> 403 (Staff lacks orders:export permission)
      currentSessionUser = staffUser;
      const resStaff = await exportOrdersRouteHandler(req);
      expect(resStaff.status).toBe(403);

      // Admin -> 200 with text/csv
      currentSessionUser = adminUser;
      const resAdmin = await exportOrdersRouteHandler(req);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.headers.get("content-type")).toContain("text/csv");
      const csvAdmin = await resAdmin.text();
      expect(csvAdmin).toContain("Order Number");

      // Owner -> 200 with text/csv
      currentSessionUser = ownerUser;
      const resOwner = await exportOrdersRouteHandler(req);
      expect(resOwner.status).toBe(200);
      expect(resOwner.headers.get("content-type")).toContain("text/csv");
    });
  });

  describe("3. Real Entry Points: Admin Server Actions Authorization & Tenant Isolation", () => {
    it("fulfillOrderAction: enforces authentication, orders:fulfill permission, and tenant isolation", async () => {
      // 1. Anonymous
      currentSessionUser = null;
      await expect(
        fulfillOrderAction({ orderId: storeAOrderId, status: "processing" }),
      ).rejects.toThrow("Authentication required");

      // 2. Customer
      currentSessionUser = customerUserA;
      await expect(
        fulfillOrderAction({ orderId: storeAOrderId, status: "processing" }),
      ).rejects.toThrow(
        "Permission denied: Role 'customer' lacks required permission 'orders:fulfill'",
      );

      // 3. Foreign Staff (Store B staff attempting to fulfill Store A order) -> Tenant Isolation!
      currentSessionUser = foreignStaffUser;
      await expect(
        fulfillOrderAction({ orderId: storeAOrderId, status: "processing" }),
      ).rejects.toThrow("Access denied for specified store context");

      // 4. Staff (Store A staff) -> Success!
      currentSessionUser = staffUser;
      const resStaff = await fulfillOrderAction({ orderId: storeAOrderId, status: "processing" });
      expect(resStaff.success).toBe(true);
    });

    it("refundOrderAction: prohibits staff from refunding, permits admin and owner", async () => {
      const [orderForRefund] = await db
        .insert(schema.orders)
        .values({
          storeId: storeAId,
          orderNumber: `ORD-REF-${Date.now()}`,
          customerId: customerUserA.id,
          guestAccessToken: `guest-ref-${Date.now()}`,
          idempotencyKey: `idem-ref-${Date.now()}`,
          checkoutSessionId: `sess-ref-${Date.now()}`,
          status: "paid",
          paymentStatus: "paid",
          paymentProvider: "midtrans",
          paymentTransactionId: `midtrans-tx-${Date.now()}`,
          currency: "IDR",
          subtotal: 100000,
          shippingAmount: 15000,
          totalAmount: 115000,
          shippingCarrier: "JNE",
          shippingService: "REG",
          shippingAddress: defaultAddress,
        })
        .returning();

      // 1. Staff (lacks orders:refund)
      currentSessionUser = staffUser;
      await expect(
        refundOrderAction({
          orderId: orderForRefund!.id,
          amountMinor: 50000,
          reason: "Customer requested partial return",
        }),
      ).rejects.toThrow(
        "Permission denied: Role 'staff' lacks required permission 'orders:refund'",
      );

      // 2. Admin -> Allowed!
      currentSessionUser = adminUser;
      const resAdmin = await refundOrderAction({
        orderId: orderForRefund!.id,
        amountMinor: 10000,
        reason: "Admin approved refund",
      });
      expect(resAdmin.success).toBe(true);
      expect(resAdmin.providerRefundId).toBeDefined();
    });

    it("adjustStockAction: blocks customer, permits staff and admin", async () => {
      currentSessionUser = customerUserA;
      await expect(
        adjustStockAction({
          variantId: testVariantId,
          delta: 5,
          reason: "Received new shipment",
        }),
      ).rejects.toThrow(
        "Permission denied: Role 'customer' lacks required permission 'inventory:adjust'",
      );

      currentSessionUser = staffUser;
      const resStaff = await adjustStockAction({
        variantId: testVariantId,
        delta: 5,
        reason: "Staff counted extra inventory",
      });
      expect(resStaff.success).toBe(true);
      expect(resStaff.newStock).toBe(105);
    });

    it("createDiscountAction: blocks staff, permits admin and owner", async () => {
      currentSessionUser = staffUser;
      await expect(
        createDiscountAction({
          code: `DISC-${Date.now()}`,
          type: "percentage",
          value: 10,
          isActive: true,
        }),
      ).rejects.toThrow(
        "Permission denied: Role 'staff' lacks required permission 'discounts:manage'",
      );

      currentSessionUser = adminUser;
      const resAdmin = await createDiscountAction({
        code: `ADMIN-DISC-${Date.now()}`,
        type: "percentage",
        value: 15,
        isActive: true,
      });
      expect(resAdmin.success).toBe(true);
      expect(resAdmin.discount.id).toBeDefined();
    });

    it("updateStoreSettingsAction: blocks staff, permits admin", async () => {
      currentSessionUser = staffUser;
      await expect(
        updateStoreSettingsAction({
          name: "Updated Store Name",
          lowStockThreshold: 5,
          taxRatePercent: 11,
          taxInclusive: false,
        }),
      ).rejects.toThrow(
        "Permission denied: Role 'staff' lacks required permission 'settings:manage'",
      );

      currentSessionUser = adminUser;
      const resAdmin = await updateStoreSettingsAction({
        name: "Store Alpha Updated",
        lowStockThreshold: 5,
        taxRatePercent: 11,
        taxInclusive: false,
      });
      expect(resAdmin.success).toBe(true);
    });

    it("inviteStaffAction: blocks staff, permits owner", async () => {
      currentSessionUser = staffUser;
      await expect(
        inviteStaffAction({
          email: `newhire-${Date.now()}@example.test`,
          role: "staff",
        }),
      ).rejects.toThrow("Permission denied: Role 'staff' lacks required permission 'staff:manage'");

      currentSessionUser = ownerUser;
      const resOwner = await inviteStaffAction({
        email: `newhire-owner-${Date.now()}@example.test`,
        role: "staff",
      });
      expect(resOwner.success).toBe(true);
      expect(resOwner.invitationId).toBeDefined();
    });
  });

  describe("4. Real Entry Points: Storefront Account Order Pages & Strict IDOR Prevention", () => {
    it("CustomerOrderDetailPage: prevents IDOR access when customer B attempts to view customer A's order", async () => {
      // Customer B tries to view Customer A's orderNumber -> throws NEXT_NOT_FOUND (strict IDOR protection)
      currentSessionUser = customerUserB;
      await expect(
        CustomerOrderDetailPage({
          params: Promise.resolve({ locale: "id", orderNumber: storeAOrderNumber }),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      // Customer A views their own order -> renders successfully!
      currentSessionUser = customerUserA;
      const viewCustA = await CustomerOrderDetailPage({
        params: Promise.resolve({ locale: "id", orderNumber: storeAOrderNumber }),
      });
      expect(extractText(viewCustA)).toContain(storeAOrderNumber);
    });

    it("AccountOrdersPage: isolates customer order lists so customer B never sees customer A's orders", async () => {
      // Customer A sees Order A
      currentSessionUser = customerUserA;
      const viewA = await AccountOrdersPage({ params: Promise.resolve({ locale: "id" }) });
      expect(extractText(viewA)).toContain(storeAOrderNumber);

      // Customer B does NOT see Order A
      currentSessionUser = customerUserB;
      const viewB = await AccountOrdersPage({ params: Promise.resolve({ locale: "id" }) });
      expect(extractText(viewB)).not.toContain(storeAOrderNumber);
    });
  });
});
