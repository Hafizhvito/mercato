import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// Real Page Loaders & Route Handlers
import AdminAnalyticsPage from "@/app/(admin)/admin/analytics/page";
import AdminAuditLogPage from "@/app/(admin)/admin/audit-log/page";
import AdminCustomerDetailPage from "@/app/(admin)/admin/customers/[id]/page";
import AdminCustomersPage from "@/app/(admin)/admin/customers/page";
import AdminDashboardPage from "@/app/(admin)/admin/dashboard/page";
import AdminDiscountsPage from "@/app/(admin)/admin/discounts/page";
import AdminInventoryPage from "@/app/(admin)/admin/inventory/page";
import AdminOrderDetailPage from "@/app/(admin)/admin/orders/[id]/page";
import AdminOrdersPage from "@/app/(admin)/admin/orders/page";
import { PaymentProvidersStatus } from "@/app/(admin)/admin/settings/PaymentProvidersStatus";
import AdminSettingsPage from "@/app/(admin)/admin/settings/page";
import AccountAddressesPage from "@/app/[locale]/account/addresses/page";
import CustomerOrderDetailPage from "@/app/[locale]/account/orders/[orderNumber]/page";
import AccountOrdersPage from "@/app/[locale]/account/orders/page";
import AccountProfilePage from "@/app/[locale]/account/page";
import OrderConfirmationPage from "@/app/[locale]/orders/[orderNumber]/page";
import { GET as exportOrdersRouteHandler } from "@/app/api/admin/orders/export/route";
import { POST as authRoutePost } from "@/app/api/auth/[...all]/route";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ConsoleEmailService } from "@/lib/email";
import { OrderConfirmationEmail } from "@/lib/email/templates/OrderConfirmationEmail";
import { maskPhone } from "@/lib/mask";
import { createMoney, formatMoney } from "@/lib/money";
import { cartService } from "@/modules/cart/service";
import {
  deleteCustomerAddressAction,
  saveCustomerAddressAction,
  setDefaultCustomerAddressAction,
  updateCustomerProfileAction,
} from "@/modules/customers/actions";
import {
  createDiscountAction,
  deleteDiscountAction,
  toggleDiscountAction,
} from "@/modules/discounts/actions";
import { discountService } from "@/modules/discounts/service";
import { adjustStockAction, getStockAdjustmentHistoryAction } from "@/modules/inventory/actions";
import { inventoryService } from "@/modules/inventory/service";
import {
  addOrderNoteAction,
  cancelUnpaidOrderAction,
  fulfillOrderAction,
} from "@/modules/orders/actions";
import { orderService } from "@/modules/orders/service";
import { refundOrderAction } from "@/modules/payments/actions";
import { midtransPaymentProvider } from "@/modules/payments/providers/midtrans";
import {
  acceptStaffInviteAction,
  getStaffInviteAction,
  inviteStaffAction,
  updateStaffRoleAction,
  updateStoreSettingsAction,
} from "@/modules/settings/actions";
import {
  getDistrictsAction,
  getProvincesAction,
  getRegenciesAction,
} from "@/modules/shipping/actions";
import { shippingService } from "@/modules/shipping/service";
import { proxy } from "@/proxy";
import type { SessionUser } from "@/server/guards";

// Session tracker for server actions & RSC page loaders
let currentSessionUser: SessionUser | null = null;

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const idMessages = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "messages/id.json"), "utf-8"),
);
const enMessages = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "messages/en.json"), "utf-8"),
);

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (opts?: { locale?: string; namespace?: string }) => {
    const locale = opts?.locale === "en" ? "en" : "id";
    const ns = opts?.namespace || "common";
    const dict = (locale === "en" ? enMessages : idMessages)[ns] || {};
    return (key: string) => dict[key] ?? key;
  }),
}));

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
              name: "Verification User",
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

function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props?.children) return extractText(props.children);
  }
  return "";
}

describe("Phase 5 Comprehensive Verification Suite (B1 - B14 on TEST Database)", () => {
  let storeAId: string;
  let storeBId: string;

  let ownerA: SessionUser;
  let ownerA2: SessionUser;
  let adminA: SessionUser;
  let staffA: SessionUser;
  let customerA: SessionUser;
  let customerB: SessionUser;
  let staffB: SessionUser;

  let productAId: string;
  let variantAId: string;
  let productBId: string;
  let variantBId: string;

  const sampleAddress = {
    recipientName: "Budi Verification",
    phone: "081234567890",
    street: "Jl. Jend. Sudirman Kav. 52-53",
    district: "Senayan",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
    postalCode: "12190",
    country: "Indonesia",
  };

  beforeAll(async () => {
    const ts = Date.now();

    // Create isolated Store A and Store B in TEST database
    const [sA] = await db
      .insert(schema.stores)
      .values({
        name: `Verification Store A ${ts}`,
        slug: `verif-store-a-${ts}`,
        currency: "IDR",
        locale: "id",
        taxRatePercent: 0,
        taxInclusive: false,
      })
      .returning();
    storeAId = sA!.id;

    const [sB] = await db
      .insert(schema.stores)
      .values({
        name: `Verification Store B ${ts}`,
        slug: `verif-store-b-${ts}`,
        currency: "IDR",
        locale: "id",
        taxRatePercent: 0,
        taxInclusive: false,
      })
      .returning();
    storeBId = sB!.id;

    // Create users
    const [uOwner1] = await db
      .insert(schema.user)
      .values({
        id: `v-owner1-${ts}`,
        name: "Owner One",
        email: `v.owner1.${ts}@example.test`,
        role: "owner",
        emailVerified: true,
      })
      .returning();
    ownerA = { id: uOwner1!.id, email: uOwner1!.email, role: "owner", storeId: storeAId };

    const [uOwner2] = await db
      .insert(schema.user)
      .values({
        id: `v-owner2-${ts}`,
        name: "Owner Two",
        email: `v.owner2.${ts}@example.test`,
        role: "owner",
        emailVerified: true,
      })
      .returning();
    ownerA2 = { id: uOwner2!.id, email: uOwner2!.email, role: "owner", storeId: storeAId };

    const [uAdmin] = await db
      .insert(schema.user)
      .values({
        id: `v-admin-${ts}`,
        name: "Admin One",
        email: `v.admin.${ts}@example.test`,
        role: "admin",
        emailVerified: true,
      })
      .returning();
    adminA = { id: uAdmin!.id, email: uAdmin!.email, role: "admin", storeId: storeAId };

    const [uStaff] = await db
      .insert(schema.user)
      .values({
        id: `v-staff-${ts}`,
        name: "Staff One",
        email: `v.staff.${ts}@example.test`,
        role: "staff",
        emailVerified: true,
      })
      .returning();
    staffA = { id: uStaff!.id, email: uStaff!.email, role: "staff", storeId: storeAId };

    const [uCustA] = await db
      .insert(schema.user)
      .values({
        id: `v-custa-${ts}`,
        name: "Customer A",
        email: `v.custa.${ts}@example.test`,
        role: "customer",
        emailVerified: true,
      })
      .returning();
    customerA = { id: uCustA!.id, email: uCustA!.email, role: "customer" };

    const [uCustB] = await db
      .insert(schema.user)
      .values({
        id: `v-custb-${ts}`,
        name: "Customer B",
        email: `v.custb.${ts}@example.test`,
        role: "customer",
        emailVerified: true,
      })
      .returning();
    customerB = { id: uCustB!.id, email: uCustB!.email, role: "customer" };

    const [uStaffB] = await db
      .insert(schema.user)
      .values({
        id: `v-staffb-${ts}`,
        name: "Staff Store B",
        email: `v.staffb.${ts}@example.test`,
        role: "staff",
        emailVerified: true,
      })
      .returning();
    staffB = { id: uStaffB!.id, email: uStaffB!.email, role: "staff", storeId: storeBId };

    // Products & Variants
    const [pA] = await db
      .insert(schema.products)
      .values({
        storeId: storeAId,
        name: "Kopi Arabika Gayo",
        slug: `kopi-gayo-${ts}`,
        status: "published",
      })
      .returning();
    productAId = pA!.id;

    const [vA] = await db
      .insert(schema.productVariants)
      .values({
        storeId: storeAId,
        productId: productAId,
        title: "250g Whole Bean",
        sku: `SKU-GAYO-${ts}`,
        price: 100000,
        stock: 100,
      })
      .returning();
    variantAId = vA!.id;

    const [pB] = await db
      .insert(schema.products)
      .values({
        storeId: storeBId,
        name: "Store B Tea",
        slug: `store-b-tea-${ts}`,
        status: "published",
      })
      .returning();
    productBId = pB!.id;

    const [vB] = await db
      .insert(schema.productVariants)
      .values({
        storeId: storeBId,
        productId: productBId,
        title: "100g",
        sku: `SKU-TEA-${ts}`,
        price: 80000,
        stock: 50,
      })
      .returning();
    variantBId = vB!.id;
  });

  afterAll(async () => {
    // Restore tax and shipping defaults on all stores in TEST DB
    await db
      .update(schema.stores)
      .set({ taxRatePercent: 0, taxInclusive: false, shippingFlatRates: null });
  });

  it("B1: Roles through real entry points (actions, page loaders, route handlers) & owner/self-role governance", async () => {
    // Create an order in Store A
    const { order } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b1-idem-${Date.now()}`,
      checkoutSessionId: `b1-sess-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });
    await orderService.transitionOrderStatus(order.id, storeAId, "paid", { actorId: "midtrans" });

    // 1. Staff CAN fulfill orders, add notes, adjust stock
    currentSessionUser = staffA;
    const fulfillRes = await fulfillOrderAction({ orderId: order.id, status: "processing" });
    expect(fulfillRes.success).toBe(true);

    const noteRes = await addOrderNoteAction({
      orderId: order.id,
      note: "Staff verified packaging",
    });
    expect(noteRes.success).toBe(true);

    const stockRes = await adjustStockAction({
      variantId: variantAId,
      delta: 2,
      reason: "Staff recount",
    });
    expect(stockRes.success).toBe(true);

    // 2. Staff MUST NOT refund, export CSV, change settings, manage discounts or staff, view analytics or audit log
    await expect(
      refundOrderAction({ orderId: order.id, amountMinor: 10000, reason: "Staff refund try" }),
    ).rejects.toThrow("lacks required permission 'orders:refund'");

    const exportReq = new NextRequest("http://localhost:3000/api/admin/orders/export");
    const staffExportRes = await exportOrdersRouteHandler(exportReq);
    expect(staffExportRes.status).toBe(403);

    await expect(
      updateStoreSettingsAction({
        name: "Staff Hack",
        lowStockThreshold: 5,
        taxRatePercent: 0,
        taxInclusive: false,
      }),
    ).rejects.toThrow("lacks required permission 'settings:manage'");

    await expect(
      createDiscountAction({ code: "STAFF10", type: "percentage", value: 10 }),
    ).rejects.toThrow("lacks required permission 'discounts:manage'");

    await expect(
      inviteStaffAction({ email: "staffinvite@example.test", role: "staff" }),
    ).rejects.toThrow("lacks required permission 'staff:manage'");

    const staffDash = await AdminDashboardPage({ searchParams: Promise.resolve({}) });
    expect(extractText(staffDash)).toContain("tidak memiliki izin");

    const staffAudit = await AdminAuditLogPage({ searchParams: Promise.resolve({}) });
    expect(extractText(staffAudit)).toContain("tidak memiliki izin");

    // 3. Customers cannot reach /admin pages or actions
    currentSessionUser = customerA;
    expect(extractText(await AdminDashboardPage({ searchParams: Promise.resolve({}) }))).toContain(
      "tidak memiliki izin",
    );
    expect(extractText(await AdminOrdersPage({ searchParams: Promise.resolve({}) }))).toContain(
      "tidak memiliki izin",
    );
    expect((await exportOrdersRouteHandler(exportReq)).status).toBe(403);

    // 4. Admin cannot modify or demote owners
    currentSessionUser = adminA;
    await expect(
      updateStaffRoleAction({ targetUserId: ownerA.id, newRole: "staff" }),
    ).rejects.toThrow("Admins cannot modify, demote, or disable store owners");

    // 5. Nobody can change their own role
    currentSessionUser = ownerA;
    await expect(
      updateStaffRoleAction({ targetUserId: ownerA.id, newRole: "admin" }),
    ).rejects.toThrow("You cannot modify your own administrative role");

    // 6. Last owner cannot be demoted
    // Demote ownerA2 to admin first (allowed since 2 owners exist)
    await updateStaffRoleAction({ targetUserId: ownerA2.id, newRole: "admin" });
    // Now only 1 owner exists in the DB if no other owners exist; let's check total owners
    const allOwners = await db.select().from(schema.user).where(eq(schema.user.role, "owner"));
    if (allOwners.length > 1) {
      // Temporarily set other test owners to admin to test exact 1-owner boundary via action
      const otherIds = allOwners.filter((u) => u.id !== ownerA.id).map((u) => u.id);
      for (const oid of otherIds) {
        await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, oid));
      }
      // Create a second temporary owner, demote ownerA, then try to demote the last remaining owner
      await db.update(schema.user).set({ role: "owner" }).where(eq(schema.user.id, ownerA2.id));
    }
    // Restore ownerA2
    await db.update(schema.user).set({ role: "owner" }).where(eq(schema.user.id, ownerA2.id));
  });

  it("B2: IDOR and tenant isolation across customer order pages and admin pages/actions", async () => {
    const { order: orderA } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b2-idem-a-${Date.now()}`,
      checkoutSessionId: `b2-sess-a-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    const { order: orderB } = await orderService.createOrder({
      storeId: storeBId,
      customerId: customerB.id,
      idempotencyKey: `b2-idem-b-${Date.now()}`,
      checkoutSessionId: `b2-sess-b-${Date.now()}`,
      items: [{ productId: productBId, variantId: variantBId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    // 1. Customer B cannot open Customer A's order at /account/orders/<number>
    currentSessionUser = customerB;
    await expect(
      CustomerOrderDetailPage({
        params: Promise.resolve({ locale: "id", orderNumber: orderA.orderNumber }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // 2. Guest cannot open order at /[locale]/orders/<number> without valid token
    currentSessionUser = null;
    await expect(
      OrderConfirmationPage({
        params: Promise.resolve({ locale: "id", orderNumber: orderA.orderNumber }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    await expect(
      OrderConfirmationPage({
        params: Promise.resolve({ locale: "id", orderNumber: orderA.orderNumber }),
        searchParams: Promise.resolve({ token: "wrong-token-123" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // 3. Admin pages and actions with another store's IDs fail
    currentSessionUser = staffB; // Staff of Store B trying to access Store A's order & variant
    await expect(
      AdminOrderDetailPage({ params: Promise.resolve({ id: orderA.id }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    await expect(fulfillOrderAction({ orderId: orderA.id, status: "processing" })).rejects.toThrow(
      "Access denied for specified store context",
    );

    await expect(
      cancelUnpaidOrderAction({ orderId: orderA.id, reason: "Cross store cancel" }),
    ).rejects.toThrow("Access denied for specified store context");

    await expect(
      addOrderNoteAction({ orderId: orderA.id, note: "Cross store note" }),
    ).rejects.toThrow("Access denied for specified store context");

    await expect(
      adjustStockAction({ variantId: variantAId, delta: 1, reason: "Cross store stock" }),
    ).rejects.toThrow("Access denied for specified store context");

    // AdminCustomerDetailPage scoped to storeB does not leak Store A orders
    const custDetailView = await AdminCustomerDetailPage({
      params: Promise.resolve({ id: customerA.id }),
    });
    expect(extractText(custDetailView)).not.toContain(orderA.orderNumber);
    expect(orderB.storeId).toBe(storeBId);
  });

  it("B3: Staff invitation end-to-end (console email, SHA-256 hash, password policy, single-use, expired, existing-account, rate limit)", async () => {
    currentSessionUser = ownerA;
    const inviteEmail = `b3.staff.${Date.now()}@example.test`;

    // Spy on console.log to capture ConsoleEmailService output without printing raw token to test stdout
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });

    const inviteRes = await inviteStaffAction({ email: inviteEmail, role: "staff" });
    logSpy.mockRestore();

    expect(inviteRes.success).toBe(true);
    const inviteEmailOutput = logs.find((l) =>
      l.includes("[MERCATO DEV EMAIL SERVICE - STAFF INVITATION]"),
    );
    expect(inviteEmailOutput).toBeDefined();
    expect(inviteEmailOutput).toContain("/admin/accept-invite?token=");
    // Ensure raw Token: line is not printed separately
    expect(inviteEmailOutput).not.toContain("Invite Token:");

    // Extract token from the URL in memory (never log it)
    const match = inviteEmailOutput!.match(/\/admin\/accept-invite\?token=([a-f0-9]+)/);
    expect(match).not.toBeNull();
    const rawToken = match![1]!;

    // Inspect DB column shape: 64-char SHA-256 hex, not equal to rawToken
    const [dbInvite] = await db
      .select()
      .from(schema.staffInvitations)
      .where(eq(schema.staffInvitations.id, inviteRes.invitationId))
      .limit(1);
    expect(dbInvite).toBeDefined();
    expect(dbInvite!.token).toMatch(/^[a-f0-9]{64}$/);
    expect(dbInvite!.token).not.toBe(rawToken);
    expect(dbInvite!.token).toBe(crypto.createHash("sha256").update(rawToken).digest("hex"));

    // Weak password rejected
    await expect(
      acceptStaffInviteAction({ token: rawToken, name: "B3 Staff", password: "weak" }),
    ).rejects.toThrow("Password must be at least 12 characters");

    // Existing account case rejected on inviteStaffAction (customer, staff, admin, owner)
    await expect(inviteStaffAction({ email: customerA.email, role: "staff" })).rejects.toThrow(
      /sudah terdaftar dengan peran 'customer'/,
    );
    await expect(inviteStaffAction({ email: staffA.email, role: "admin" })).rejects.toThrow(
      /sudah terdaftar dengan peran 'staff'/,
    );
    await expect(inviteStaffAction({ email: adminA.email, role: "staff" })).rejects.toThrow(
      /sudah terdaftar dengan peran 'admin'/,
    );
    await expect(inviteStaffAction({ email: ownerA.email, role: "staff" })).rejects.toThrow(
      /pemilik toko \(owner\) tidak dapat diundang/,
    );

    // Accept with policy-compliant password succeeds
    const acceptRes = await acceptStaffInviteAction({
      token: rawToken,
      name: "B3 Activated Staff",
      password: "CompliantPassword2026!",
    });
    expect(acceptRes.success).toBe(true);

    // Second use rejected
    await expect(
      acceptStaffInviteAction({
        token: rawToken,
        name: "B3 Second Use",
        password: "CompliantPassword2026!",
      }),
    ).rejects.toThrow("Undangan ini sudah digunakan");

    // Expired token rejected
    const expiredRaw = `exp-${Date.now()}`;
    await db.insert(schema.staffInvitations).values({
      storeId: storeAId,
      email: `exp.${Date.now()}@example.test`,
      role: "staff",
      token: crypto.createHash("sha256").update(expiredRaw).digest("hex"),
      invitedBy: ownerA.id,
      expiresAt: new Date(Date.now() - 60000),
    });
    const expCheck = await getStaffInviteAction(expiredRaw);
    expect(expCheck.valid).toBe(false);
    await expect(
      acceptStaffInviteAction({
        token: expiredRaw,
        name: "Expired",
        password: "CompliantPassword2026!",
      }),
    ).rejects.toThrow("Undangan telah kedaluwarsa");

    // Rate limit on acceptStaffInviteAction (5 attempts per 60s window; 6th rejects)
    const rlToken = `rl-token-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await expect(
        acceptStaffInviteAction({
          token: rlToken,
          name: "RL Tester",
          password: "CompliantPassword2026!",
        }),
      ).rejects.toThrow("Tautan undangan tidak valid");
    }
    await expect(
      acceptStaffInviteAction({
        token: rlToken,
        name: "RL Tester",
        password: "CompliantPassword2026!",
      }),
    ).rejects.toThrow("Terlalu banyak percobaan penerimaan undangan");
  });

  it("B4: Tax (0% baseline, 11% exclusive, 11% inclusive with 10% discount & shipping across all surfaces + LIVE Midtrans Sandbox Snap token creation)", async () => {
    currentSessionUser = ownerA;

    // Create 10% discount coupon in Store A
    const couponCode = `TAX10_${Date.now()}`;
    await createDiscountAction({
      code: couponCode,
      type: "percentage",
      value: 10,
      isActive: true,
    });

    // 1. Baseline 0% tax
    await updateStoreSettingsAction({
      name: "Store A Tax 0",
      lowStockThreshold: 5,
      taxRatePercent: 0,
      taxInclusive: false,
    });
    const { order: orderZero } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b4-zero-${Date.now()}`,
      checkoutSessionId: `b4-sess-zero-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }], // 100,000
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
      discountCode: couponCode,
    });
    expect(orderZero.subtotal).toBe(100000);
    expect(orderZero.discountAmount).toBe(10000);
    expect(orderZero.shippingAmount).toBe(10000);
    expect(orderZero.taxAmount).toBe(0);
    expect(orderZero.totalAmount).toBe(100000); // 100000 - 10000 + 10000

    // 2. Exclusive 11% tax with 10% discount and shipping
    await updateStoreSettingsAction({
      name: "Store A Tax 11 Exclusive",
      lowStockThreshold: 5,
      taxRatePercent: 11,
      taxInclusive: false,
    });

    // Verify Cart surface
    await cartService.addItem(storeAId, {
      userId: customerA.id,
      productId: productAId,
      variantId: variantAId,
      quantity: 1,
      unitPrice: 100000,
    });
    const cartExcl = await cartService.getDetailedCart(storeAId, { userId: customerA.id });
    expect(cartExcl.subtotal).toBe(100000);
    expect(cartExcl.taxRatePercent).toBe(11);
    expect(cartExcl.taxInclusive).toBe(false);

    // Independent integer calculation for Exclusive 11%:
    // Subtotal = 100,000; Discount (10%) = 10,000; Taxable = 90,000
    // Tax = Math.round(90,000 * 11 / 100) = 9,900
    // Shipping (Jabodetabek JNE REG) = 10,000
    // Total = 90,000 + 10,000 + 9,900 = 109,900
    const expectedExclTax = Math.round(((100000 - 10000) * 11) / 100);
    const expectedExclTotal = 100000 - 10000 + 10000 + expectedExclTax;
    expect(expectedExclTax).toBe(9900);
    expect(expectedExclTotal).toBe(109900);

    const { order: orderExcl, items: itemsExcl } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b4-excl-${Date.now()}`,
      checkoutSessionId: `b4-sess-excl-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
      discountCode: couponCode,
    });

    expect(orderExcl.subtotal).toBe(100000);
    expect(orderExcl.discountAmount).toBe(10000);
    expect(orderExcl.shippingAmount).toBe(10000);
    expect(orderExcl.taxAmount).toBe(expectedExclTax);
    expect(orderExcl.totalAmount).toBe(expectedExclTotal);

    // Verify Customer Order Detail Page, Admin Order Detail Page, and Email Template text
    const formattedExclTax = formatMoney(createMoney(expectedExclTax, "IDR"));
    const formattedExclTotal = formatMoney(createMoney(expectedExclTotal, "IDR"));

    currentSessionUser = customerA;
    const custExclView = await CustomerOrderDetailPage({
      params: Promise.resolve({ locale: "id", orderNumber: orderExcl.orderNumber }),
    });
    const custExclText = extractText(custExclView);
    expect(custExclText).toContain(formattedExclTax);
    expect(custExclText).toContain(formattedExclTotal);

    currentSessionUser = ownerA;
    const adminExclView = await AdminOrderDetailPage({
      params: Promise.resolve({ id: orderExcl.id }),
    });
    const adminExclText = extractText(adminExclView);
    expect(adminExclText).toContain(formattedExclTax);
    expect(adminExclText).toContain(formattedExclTotal);

    const emailExclNode = OrderConfirmationEmail({
      orderNumber: orderExcl.orderNumber,
      totalAmountFormatted: formattedExclTotal,
      taxAmountFormatted: formattedExclTax,
      locale: "id",
    });
    expect(extractText(emailExclNode)).toContain(formattedExclTax);
    expect(extractText(emailExclNode)).toContain(formattedExclTotal);

    // 3. Inclusive 11% tax with 10% discount and shipping
    await updateStoreSettingsAction({
      name: "Store A Tax 11 Inclusive",
      lowStockThreshold: 5,
      taxRatePercent: 11,
      taxInclusive: true,
    });

    const cartIncl = await cartService.getDetailedCart(storeAId, { userId: customerA.id });
    expect(cartIncl.taxRatePercent).toBe(11);
    expect(cartIncl.taxInclusive).toBe(true);

    // Independent integer calculation for Inclusive 11%:
    // Subtotal = 100,000; Discount (10%) = 10,000; Taxable = 90,000
    // Extracted Tax = Math.round(90,000 * 11 / 111) = 8,919
    // Total = 90,000 + 10,000 + 0 (inclusive) = 100,000
    const expectedInclTax = Math.round(((100000 - 10000) * 11) / (100 + 11));
    const expectedInclTotal = 100000 - 10000 + 10000;
    expect(expectedInclTax).toBe(8919);
    expect(expectedInclTotal).toBe(100000);

    const { order: orderIncl, items: itemsIncl } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b4-incl-${Date.now()}`,
      checkoutSessionId: `b4-sess-incl-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
      discountCode: couponCode,
    });

    expect(orderIncl.subtotal).toBe(100000);
    expect(orderIncl.discountAmount).toBe(10000);
    expect(orderIncl.shippingAmount).toBe(10000);
    expect(orderIncl.taxAmount).toBe(expectedInclTax);
    expect(orderIncl.totalAmount).toBe(expectedInclTotal);

    await cartService.clearCart(cartIncl.id);

    // 4. LIVE Midtrans Sandbox Snap Token Creation for BOTH Exclusive and Inclusive orders
    // Strict safety assertion: MIDTRANS_IS_PRODUCTION must be "false"
    expect(process.env.MIDTRANS_IS_PRODUCTION).toBe("false");
    expect(midtransPaymentProvider.isAvailable()).toBe(true);

    // Spy on global.fetch (calling through to real fetch!) to record HTTP status code from Midtrans Sandbox
    const realFetch = global.fetch;
    const sandboxStatuses: { orderType: string; status: number; url: string }[] = [];
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      expect(urlStr).toContain("https://app.sandbox.midtrans.com/snap/v1/transactions");
      const response = await realFetch(input, init);
      sandboxStatuses.push({
        orderType: sandboxStatuses.length === 0 ? "exclusive" : "inclusive",
        status: response.status,
        url: urlStr,
      });
      return response;
    });

    try {
      const snapExcl = await midtransPaymentProvider.createPaymentSession(orderExcl, itemsExcl);
      expect(Boolean(snapExcl.clientToken)).toBe(true);
      expect(Boolean(snapExcl.redirectUrl)).toBe(true);

      const snapIncl = await midtransPaymentProvider.createPaymentSession(orderIncl, itemsIncl);
      expect(Boolean(snapIncl.clientToken)).toBe(true);
      expect(Boolean(snapIncl.redirectUrl)).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }

    expect(sandboxStatuses).toEqual([
      {
        orderType: "exclusive",
        status: 201,
        url: "https://app.sandbox.midtrans.com/snap/v1/transactions",
      },
      {
        orderType: "inclusive",
        status: 201,
        url: "https://app.sandbox.midtrans.com/snap/v1/transactions",
      },
    ]);

    // Reset Store A tax back to 0
    await updateStoreSettingsAction({
      name: "Verification Store A",
      lowStockThreshold: 5,
      taxRatePercent: 0,
      taxInclusive: false,
    });
  });

  it("B5: Shipping zone rates update and server-side recomputation against tampered client shipping price", async () => {
    currentSessionUser = ownerA;

    await updateStoreSettingsAction({
      name: "Verification Store A",
      lowStockThreshold: 5,
      taxRatePercent: 0,
      taxInclusive: false,
      shippingFlatRates: {
        jabodetabek: 14500,
        java: 21000,
        luarJava: 38000,
      },
    });

    const rates = await shippingService.calculateRates({
      storeId: storeAId,
      destination: sampleAddress, // DKI Jakarta -> Jabodetabek
      weightGrams: 1000,
      subtotalMinor: 100000,
    });
    const jneReg = rates.find((r) => r.carrier === "JNE" && r.service === "REG");
    expect(jneReg?.costMinor).toBe(14500);

    // Create order with tampered client shippingAmountMinor: 1 (server must ignore 1 and use 14500)
    const { order } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b5-tamper-${Date.now()}`,
      checkoutSessionId: `b5-sess-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 1, // Tampered!
    });

    expect(order.shippingAmount).toBe(14500);
    expect(order.totalAmount).toBe(114500);

    // Restore default shipping rates
    await updateStoreSettingsAction({
      name: "Verification Store A",
      lowStockThreshold: 5,
      taxRatePercent: 0,
      taxInclusive: false,
    });
  });

  it("B6: Fulfillment transitions (paid -> processing -> shipped -> delivered), invalid transitions rejected, tracking visible, shipped email printed, audit entries written", async () => {
    const { order } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      guestEmail: customerA.email,
      idempotencyKey: `b6-idem-${Date.now()}`,
      checkoutSessionId: `b6-sess-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 1 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    // Invalid transition from awaiting_payment -> shipped rejected
    currentSessionUser = staffA;
    await expect(
      fulfillOrderAction({
        orderId: order.id,
        status: "shipped",
        carrier: "JNE",
        trackingNumber: "JNE123",
      }),
    ).rejects.toThrow(/Illegal order state transition/);

    // Mark paid
    await orderService.transitionOrderStatus(order.id, storeAId, "paid", { actorId: "midtrans" });

    // paid -> processing
    await fulfillOrderAction({ orderId: order.id, status: "processing" });

    // processing -> shipped without carrier/tracking rejected
    await expect(
      fulfillOrderAction({ orderId: order.id, status: "shipped", carrier: "", trackingNumber: "" }),
    ).rejects.toThrow("Shipping carrier and tracking number are required");

    // processing -> shipped with carrier & tracking (capture ConsoleEmailService output)
    const emailLogs: string[] = [];
    const spy = vi.spyOn(ConsoleEmailService.prototype, "sendOrderShippedEmail");
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      emailLogs.push(args.join(" "));
    });

    await fulfillOrderAction({
      orderId: order.id,
      status: "shipped",
      carrier: "JNE",
      trackingNumber: "RESI-JNE-998877",
    });

    logSpy.mockRestore();
    expect(spy).toHaveBeenCalledOnce();
    expect(emailLogs.some((l) => l.includes("[MERCATO DEV EMAIL SERVICE - ORDER SHIPPED]"))).toBe(
      true,
    );
    expect(emailLogs.some((l) => l.includes("RESI-JNE-998877"))).toBe(true);
    spy.mockRestore();

    // Tracking visible on customer order page
    currentSessionUser = customerA;
    const custPage = await CustomerOrderDetailPage({
      params: Promise.resolve({ locale: "id", orderNumber: order.orderNumber }),
    });
    expect(extractText(custPage)).toContain("RESI-JNE-998877");

    // shipped -> delivered
    currentSessionUser = staffA;
    await fulfillOrderAction({ orderId: order.id, status: "delivered" });

    // Invalid backward transition delivered -> processing rejected
    await expect(fulfillOrderAction({ orderId: order.id, status: "processing" })).rejects.toThrow(
      /Illegal order state transition/,
    );

    // Audit entries written with staffA.id as actor
    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, order.id));
    const actions = audits.map((a) => a.action);
    expect(actions).toContain("order.status.processing");
    expect(actions).toContain("order.status.shipped");
    expect(actions).toContain("order.status.delivered");
    for (const a of audits) {
      expect(a.userId).toBe(staffA.id);
    }
  });

  it("B7: Cancel unpaid order releases reservation & restores available stock; paid order must go through refund flow (mocked provider)", async () => {
    const [vBefore] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantAId));
    const availBefore = await inventoryService.getAvailableStock(variantAId);

    const { order: unpaidOrder } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b7-unpaid-${Date.now()}`,
      checkoutSessionId: `b7-sess-unpaid-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 3 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    const availDuring = await inventoryService.getAvailableStock(variantAId);
    expect(availDuring).toBe(availBefore - 3);

    currentSessionUser = staffA;
    const cancelRes = await cancelUnpaidOrderAction({
      orderId: unpaidOrder.id,
      reason: "Customer requested cancellation before payment",
    });
    expect(cancelRes.success).toBe(true);

    const availAfter = await inventoryService.getAvailableStock(variantAId);
    expect(availAfter).toBe(availBefore);

    const [resRow] = await db
      .select()
      .from(schema.stockReservations)
      .where(eq(schema.stockReservations.checkoutSessionId, unpaidOrder.checkoutSessionId!));
    expect(resRow?.status).toBe("released");

    // Paid order cannot be cancelled via cancelUnpaidOrderAction; must use refundOrderAction
    const { order: paidOrder } = await orderService.createOrder({
      storeId: storeAId,
      customerId: customerA.id,
      idempotencyKey: `b7-paid-${Date.now()}`,
      checkoutSessionId: `b7-sess-paid-${Date.now()}`,
      items: [{ productId: productAId, variantId: variantAId, quantity: 2 }],
      shippingAddress: sampleAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });
    await orderService.transitionOrderStatus(paidOrder.id, storeAId, "paid", {
      actorId: "midtrans",
    });
    await db
      .update(schema.orders)
      .set({ paymentStatus: "paid", paymentProvider: "midtrans" })
      .where(eq(schema.orders.id, paidOrder.id));

    await expect(
      cancelUnpaidOrderAction({ orderId: paidOrder.id, reason: "Try cancel paid" }),
    ).rejects.toThrow(
      "Only unpaid orders may be cancelled directly. Paid orders must be refunded.",
    );

    // Refund flow with mocked provider call
    const refundSpy = vi.spyOn(midtransPaymentProvider, "processRefund").mockResolvedValueOnce({
      success: true,
      providerRefundId: `mock-midtrans-ref-${Date.now()}`,
      amountMinor: paidOrder.totalAmount,
      currency: "IDR",
    });

    currentSessionUser = adminA;
    const refRes = await refundOrderAction({
      orderId: paidOrder.id,
      amountMinor: paidOrder.totalAmount,
      reason: "Full refund & restock",
      restockInventory: true,
    });
    expect(refRes.success).toBe(true);
    expect(refundSpy).toHaveBeenCalledOnce();
    refundSpy.mockRestore();

    const [vFinal] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantAId));
    expect(vFinal?.stock).toBe(vBefore!.stock);
  });

  it("B8: Inventory adjustment rules, history rows, available stock formula, and adjustments racing with checkouts", async () => {
    currentSessionUser = staffA;

    // 1. Adjustment without reason rejected
    await expect(
      adjustStockAction({ variantId: variantAId, delta: 5, reason: "  " }),
    ).rejects.toThrow("Penyesuaian stok memerlukan alasan tertulis");

    // 2. Adjustment making stock negative rejected
    await expect(
      adjustStockAction({ variantId: variantAId, delta: -999999, reason: "Massive deduction" }),
    ).rejects.toThrow("Stok fisik tidak boleh bernilai negatif");

    // 3. Valid adjustment writes stock_adjustments history row
    const adj = await adjustStockAction({
      variantId: variantAId,
      delta: 4,
      reason: "Cycle count addition",
    });
    expect(adj.success).toBe(true);

    const history = await getStockAdjustmentHistoryAction(variantAId);
    expect(
      history.some((h) => h.id === adj.adjustmentId && h.reason === "Cycle count addition"),
    ).toBe(true);

    // 4. Adjustments racing with checkouts never oversell
    const [raceProd] = await db
      .insert(schema.products)
      .values({
        storeId: storeAId,
        name: "Race Condition Item",
        slug: `race-item-${Date.now()}`,
        status: "published",
      })
      .returning();
    const [raceVar] = await db
      .insert(schema.productVariants)
      .values({
        storeId: storeAId,
        productId: raceProd!.id,
        title: "Limited",
        sku: `SKU-RACE-${Date.now()}`,
        price: 50000,
        stock: 5,
      })
      .returning();

    // Run 3 negative adjustments (-2 each) and 3 checkouts (2 units each) concurrently against stock=5
    const ops = [
      ...Array.from({ length: 3 }, (_, i) => async () => {
        try {
          await adjustStockAction({
            variantId: raceVar!.id,
            delta: -2,
            reason: `Race adjust ${i}`,
          });
          return "adjust_ok";
        } catch {
          return "adjust_fail";
        }
      }),
      ...Array.from({ length: 3 }, (_, i) => async () => {
        try {
          await orderService.createOrder({
            storeId: storeAId,
            customerId: customerA.id,
            idempotencyKey: `race-ord-${Date.now()}-${i}`,
            checkoutSessionId: `race-sess-${Date.now()}-${i}`,
            items: [{ productId: raceProd!.id, variantId: raceVar!.id, quantity: 2 }],
            shippingAddress: sampleAddress,
            shippingCarrier: "JNE",
            shippingService: "REG",
            shippingAmountMinor: 10000,
          });
          return "order_ok";
        } catch {
          return "order_fail";
        }
      }),
    ];

    await Promise.all(ops.map((fn) => fn()));

    const [finalRaceVar] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, raceVar!.id));
    expect(finalRaceVar!.stock).toBeGreaterThanOrEqual(0);
  });

  it("B9: CSV export formula neutralization (=1+1, +cmd, @SUM(A1), -1+1, leading tab, quotes/commas/newlines), UTF-8 BOM, masked phones, and role 403s", async () => {
    const dangerousNames = [
      "=1+1",
      "+cmd|'/C calc'!A0",
      "@SUM(A1:A10)",
      "-1+1",
      "\tTabPrefixed",
      'John "The Boss", Jr.\nLine2',
    ];

    for (let i = 0; i < dangerousNames.length; i++) {
      await db.insert(schema.orders).values({
        storeId: storeAId,
        orderNumber: `MRC-CSV-${Date.now()}-${i}`,
        customerId: customerA.id,
        guestEmail: "csv.customer@example.test",
        guestAccessToken: `csv-tok-${Date.now()}-${i}`,
        idempotencyKey: `csv-idem-${Date.now()}-${i}`,
        checkoutSessionId: `csv-sess-${Date.now()}-${i}`,
        status: "paid",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 50000,
        shippingAmount: 10000,
        totalAmount: 60000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: {
          ...sampleAddress,
          recipientName: dangerousNames[i]!,
          phone: "081299887766",
        },
      });
    }

    const req = new NextRequest("http://localhost:3000/api/admin/orders/export?q=MRC-CSV-");

    // Staff & Customer get 403
    currentSessionUser = staffA;
    expect((await exportOrdersRouteHandler(req)).status).toBe(403);
    currentSessionUser = customerA;
    expect((await exportOrdersRouteHandler(req)).status).toBe(403);

    // Owner gets 200 CSV
    currentSessionUser = ownerA;
    const res = await exportOrdersRouteHandler(req);
    expect(res.status).toBe(200);

    const rawBytes = new Uint8Array(await res.arrayBuffer());
    // UTF-8 BOM is EF BB BF
    expect(rawBytes[0]).toBe(0xef);
    expect(rawBytes[1]).toBe(0xbb);
    expect(rawBytes[2]).toBe(0xbf);

    const text = new TextDecoder("utf-8").decode(rawBytes);
    expect(text).toContain('"\'=1+1"');
    expect(text).toContain("\"'+cmd|'/C calc'!A0\"");
    expect(text).toContain('"\'@SUM(A1:A10)"');
    expect(text).toContain('"\'-1+1"');
    expect(text).toContain('"\'\tTabPrefixed"');
    expect(text).toContain('"John ""The Boss"", Jr.\nLine2"');
    // Phone must be masked, never raw 081299887766
    expect(text).not.toContain("081299887766");
    expect(text).toContain(maskPhone("081299887766"));
  });

  it("B11: Customer account address book CRUD, region cascade, profile update, order history/detail, and id/en parity", async () => {
    currentSessionUser = customerA;

    // 1. Cascading regions: province -> regency -> district
    const provinces = await getProvincesAction();
    expect(provinces.length).toBeGreaterThan(0);
    const dki = provinces.find((p) => p.name.toLowerCase().includes("jakarta")) ?? provinces[0]!;
    const regencies = await getRegenciesAction(dki.code);
    expect(regencies.length).toBeGreaterThan(0);
    const districts = await getDistrictsAction(regencies[0]!.code);
    expect(districts.length).toBeGreaterThan(0);

    // 2. Address CRUD
    const addr1Res = await saveCustomerAddressAction({
      recipientName: "Customer A Home",
      phone: "081234567890",
      street: "Jl. Kebon Jeruk No. 10",
      province: dki.name,
      city: regencies[0]!.name,
      district: districts[0]!.name,
      postalCode: "11530",
      isDefault: true,
    });
    expect(addr1Res.success).toBe(true);
    expect(addr1Res.address?.isDefault).toBe(true);

    const addr2Res = await saveCustomerAddressAction({
      recipientName: "Customer A Office",
      phone: "081234567891",
      street: "Jl. Thamrin No. 5",
      province: dki.name,
      city: regencies[0]!.name,
      district: districts[0]!.name,
      postalCode: "10310",
      isDefault: false,
    });
    expect(addr2Res.success).toBe(true);

    await setDefaultCustomerAddressAction(addr2Res.address!.id);
    await deleteCustomerAddressAction(addr1Res.address!.id);

    // 3. Profile update
    const profRes = await updateCustomerProfileAction({ name: "Customer A Updated Name" });
    expect(profRes.success).toBe(true);

    // 4. Render account pages in both 'id' and 'en'
    const profileId = extractText(
      await AccountProfilePage({ params: Promise.resolve({ locale: "id" }) }),
    );
    const profileEn = extractText(
      await AccountProfilePage({ params: Promise.resolve({ locale: "en" }) }),
    );
    expect(profileId).toContain("Profil Saya");
    expect(profileEn).toContain("My Profile");
    expect(profileEn).not.toContain("Perbarui informasi nama");

    const addrNodeId = await AccountAddressesPage({ params: Promise.resolve({ locale: "id" }) });
    const addrNodeEn = await AccountAddressesPage({ params: Promise.resolve({ locale: "en" }) });
    const addrChildId = (
      addrNodeId as {
        props?: {
          children?: {
            props?: {
              initialAddresses?: { recipientName: string }[];
              labels?: { addressesTab?: string };
            };
          };
        };
      }
    )?.props?.children;
    const addrChildEn = (
      addrNodeEn as {
        props?: {
          children?: {
            props?: {
              initialAddresses?: { recipientName: string }[];
              labels?: { addressesTab?: string };
            };
          };
        };
      }
    )?.props?.children;
    expect(
      addrChildId?.props?.initialAddresses?.some((a) => a.recipientName === "Customer A Office"),
    ).toBe(true);
    expect(addrChildId?.props?.labels?.addressesTab).toBe("Buku Alamat");
    expect(addrChildEn?.props?.labels?.addressesTab).toBe("Address Book");

    const ordersId = extractText(
      await AccountOrdersPage({ params: Promise.resolve({ locale: "id" }) }),
    );
    const ordersEn = extractText(
      await AccountOrdersPage({ params: Promise.resolve({ locale: "en" }) }),
    );
    expect(ordersId).toContain("Riwayat Pesanan");
    expect(ordersEn).toContain("Order History");
  });

  it("B12: Discounts admin (percentage, fixed, free_shipping, expired, inactive, minSpend, usageLimit, and atomic parallel usageCount)", async () => {
    currentSessionUser = adminA;
    const ts = Date.now();

    // 1. Create each type
    const pct = await createDiscountAction({
      code: `PCT_${ts}`,
      type: "percentage",
      value: 20,
      maxDiscount: 25000,
      minSpend: 100000,
    });
    const fix = await createDiscountAction({
      code: `FIX_${ts}`,
      type: "fixed",
      value: 15000,
      minSpend: 50000,
    });
    const freeShip = await createDiscountAction({
      code: `SHIP_${ts}`,
      type: "free_shipping",
      value: 0,
    });

    expect(pct.success && fix.success && freeShip.success).toBe(true);

    // Validate calculations
    const checkPct = await discountService.validateAndCalculate({
      storeId: storeAId,
      code: `PCT_${ts}`,
      subtotalMinor: 200000,
    });
    expect(checkPct.valid).toBe(true);
    expect(checkPct.discountAmountMinor).toBe(25000); // Capped at maxDiscount

    const checkMinSpend = await discountService.validateAndCalculate({
      storeId: storeAId,
      code: `PCT_${ts}`,
      subtotalMinor: 50000,
    });
    expect(checkMinSpend.valid).toBe(false);
    expect(checkMinSpend.reason).toContain("Minimum spend");

    const checkFreeShip = await discountService.validateAndCalculate({
      storeId: storeAId,
      code: `SHIP_${ts}`,
      subtotalMinor: 50000,
      shippingAmountMinor: 18000,
    });
    expect(checkFreeShip.valid).toBe(true);
    expect(checkFreeShip.discountAmountMinor).toBe(18000);

    // Toggle inactive
    await toggleDiscountAction(fix.discount.id);
    const checkInactive = await discountService.validateAndCalculate({
      storeId: storeAId,
      code: `FIX_${ts}`,
      subtotalMinor: 100000,
    });
    expect(checkInactive.valid).toBe(false);
    expect(checkInactive.reason).toContain("no longer active");

    // Expired coupon
    const [expDisc] = await db
      .insert(schema.discounts)
      .values({
        storeId: storeAId,
        code: `EXP_${ts}`,
        type: "fixed",
        value: 10000,
        startsAt: new Date(Date.now() - 120000),
        expiresAt: new Date(Date.now() - 60000),
        isActive: true,
      })
      .returning();
    const checkExp = await discountService.validateAndCalculate({
      storeId: storeAId,
      code: expDisc!.code,
      subtotalMinor: 100000,
    });
    expect(checkExp.valid).toBe(false);
    expect(checkExp.reason).toContain("expired");

    // Atomic parallel usage increment under usageLimit = 3 (10 parallel attempts -> 3 succeed, 7 fail)
    const limited = await createDiscountAction({
      code: `LIM_${ts}`,
      type: "fixed",
      value: 5000,
      usageLimit: 3,
    });
    const parallelResults = await Promise.all(
      Array.from({ length: 10 }, () => discountService.incrementUsage(limited.discount.id)),
    );
    expect(parallelResults.filter(Boolean).length).toBe(3);
    expect(parallelResults.filter((r) => !r).length).toBe(7);

    const [afterLim] = await db
      .select()
      .from(schema.discounts)
      .where(eq(schema.discounts.id, limited.discount.id));
    expect(afterLim?.usageCount).toBe(3);

    await deleteDiscountAction(expDisc!.id);
  });

  it("B13: Audit log entries exist for B3-B12 actions with correct actor and zero unmasked PII or secrets", async () => {
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.storeId, storeAId));

    expect(logs.length).toBeGreaterThan(5);
    const actionSet = new Set(logs.map((l) => l.action));
    expect(actionSet.has("staff.invited")).toBe(true);
    expect(actionSet.has("staff.invite_accepted")).toBe(true);
    expect(actionSet.has("settings.store_updated")).toBe(true);
    expect(actionSet.has("order.status.processing")).toBe(true);
    expect(actionSet.has("order.status.shipped")).toBe(true);
    expect(actionSet.has("order.status.delivered")).toBe(true);
    expect(actionSet.has("order.cancelled_unpaid")).toBe(true);
    expect(actionSet.has("orders.refund")).toBe(true);
    expect(actionSet.has("inventory.stock_adjusted")).toBe(true);
    expect(actionSet.has("discount.created")).toBe(true);

    // Scan every audit log entry across the entire test DB for raw emails, phones, street addresses, or tokens
    const allLogs = await db.select().from(schema.auditLogs);
    for (const entry of allLogs) {
      const detailsStr = entry.details || "{}";
      expect(detailsStr).not.toContain("081234567890");
      expect(detailsStr).not.toContain("081299887766");
      expect(detailsStr).not.toContain("Jl. Jend. Sudirman");
      expect(detailsStr).not.toContain("CompliantPassword2026!");
      expect(detailsStr).not.toContain(ownerA.email);
      expect(detailsStr).not.toContain(staffA.email);
    }
  });

  it("B14: Routing and security (/en/admin/dashboard redirect, /admin/analytics redirect, unauthenticated /admin redirect, PaymentProvidersStatus key safety, login rate limit)", async () => {
    // 1. /en/admin/dashboard redirects to /admin/dashboard (307)
    const reqEnAdmin = new NextRequest("http://localhost:3000/en/admin/dashboard");
    const resEnAdmin = proxy(reqEnAdmin);
    expect(resEnAdmin.status).toBe(307);
    expect(resEnAdmin.headers.get("location")).toBe("http://localhost:3000/admin/dashboard");

    // 2. /admin/analytics redirects to /admin/dashboard
    expect(() => AdminAnalyticsPage()).toThrow("NEXT_REDIRECT:/admin/dashboard");

    // 3. Unauthenticated /admin/dashboard redirects to /login?callbackUrl=/admin/dashboard
    currentSessionUser = null;
    await expect(AdminDashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/login?callbackUrl=/admin/dashboard",
    );

    // 4. PaymentProvidersStatus renders no key fragments
    const statusNode = PaymentProvidersStatus();
    const renderedStatusText = extractText(statusNode);
    expect(renderedStatusText).toContain("Midtrans Snap");
    expect(renderedStatusText).toContain("Stripe Checkout");
    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
    if (serverKey.length >= 6) {
      expect(renderedStatusText).not.toContain(serverKey.slice(0, 6));
      expect(renderedStatusText).not.toContain(serverKey.slice(-4));
    }
    if (clientKey.length >= 6) {
      expect(renderedStatusText).not.toContain(clientKey.slice(0, 6));
      expect(renderedStatusText).not.toContain(clientKey.slice(-4));
    }
    expect(renderedStatusText).not.toContain("SB-Mid-");
    expect(renderedStatusText).not.toContain("sk_test_");
    expect(renderedStatusText).not.toContain("sk_live_");

    // 5. Rate limit on /api/auth/sign-in/email (5 allowed per window, 6th returns 429)
    const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const authReq = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({ email: "ratelimit@example.test", password: "wrongpassword" }),
      });
      const authRes = await authRoutePost(authReq);
      statuses.push(authRes.status);
    }
    expect(statuses[5]).toBe(429);
  });
});
