import { and, eq, inArray, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { analyticsService } from "@/modules/analytics/service";

describe("Phase 5: Analytics Asia/Jakarta Timezone Bucketing & Financial Aggregates", () => {
  let storeId: string;
  let testProductId: string;
  let testVariantId: string;

  beforeAll(async () => {
    // 1. Ensure test store
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Analytics Test Store",
        slug: `analytics-store-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeId = store!.id;

    // 2. Ensure product and variant
    const [product] = await db
      .insert(schema.products)
      .values({
        storeId,
        name: "Analytics Test Product",
        slug: `analytics-prod-${Date.now()}`,
        status: "published",
      })
      .returning();
    testProductId = product!.id;

    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        storeId,
        productId: testProductId,
        sku: `SKU-ANALYTICS-${Date.now()}`,
        title: "Standard Edition",
        price: 100000,
        stock: 50,
      })
      .returning();
    testVariantId = variant!.id;
  });

  it("accurately buckets orders across the Asia/Jakarta (WIB) midnight boundary (17:00 UTC)", async () => {
    // In UTC+7 (Asia/Jakarta):
    // 2026-06-15T16:30:00Z -> 2026-06-15 23:30 WIB (Date: 2026-06-15)
    // 2026-06-15T17:30:00Z -> 2026-06-16 00:30 WIB (Date: 2026-06-16)

    const dateBeforeBoundary = new Date("2026-06-15T16:30:00.000Z");
    const dateAfterBoundary = new Date("2026-06-15T17:30:00.000Z");

    const sampleAddress = {
      recipientName: "Analytics Customer",
      phone: "081234567890",
      street: "Jl. Analitik No. 1",
      district: "Menteng",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postalCode: "10310",
      country: "Indonesia",
    };

    const [orderBefore] = await db
      .insert(schema.orders)
      .values({
        storeId,
        orderNumber: `MRC-TZ-BEFORE-${Date.now()}`,
        guestAccessToken: `token-before-${Date.now()}`,
        idempotencyKey: `idem-tz-b-${Date.now()}-${Math.random()}`,
        checkoutSessionId: `sess-tz-b-${Date.now()}`,
        status: "delivered",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 100000,
        shippingAmount: 15000,
        totalAmount: 115000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: sampleAddress,
        createdAt: dateBeforeBoundary,
        updatedAt: dateBeforeBoundary,
      })
      .returning();

    const [orderAfter] = await db
      .insert(schema.orders)
      .values({
        storeId,
        orderNumber: `MRC-TZ-AFTER-${Date.now()}`,
        guestAccessToken: `token-after-${Date.now()}`,
        idempotencyKey: `idem-tz-a-${Date.now()}-${Math.random()}`,
        checkoutSessionId: `sess-tz-a-${Date.now()}`,
        status: "delivered",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 200000,
        shippingAmount: 15000,
        totalAmount: 215000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: sampleAddress,
        createdAt: dateAfterBoundary,
        updatedAt: dateAfterBoundary,
      })
      .returning();

    // Attach order items
    await db.insert(schema.orderItems).values([
      {
        orderId: orderBefore!.id,
        productId: testProductId,
        variantId: testVariantId,
        productName: "Analytics Test Product",
        variantTitle: "Standard Edition",
        sku: "SKU-ANALYTICS-1",
        quantity: 1,
        unitPrice: 100000,
        totalPrice: 100000,
      },
      {
        orderId: orderAfter!.id,
        productId: testProductId,
        variantId: testVariantId,
        productName: "Analytics Test Product",
        variantTitle: "Standard Edition",
        sku: "SKU-ANALYTICS-1",
        quantity: 2,
        unitPrice: 100000,
        totalPrice: 200000,
      },
    ]);

    // Query metrics covering June 14 to June 18 2026
    const from = new Date("2026-06-14T00:00:00.000Z");
    const to = new Date("2026-06-18T23:59:59.999Z");

    const metrics = await analyticsService.getDashboardMetrics(storeId, {
      from,
      to,
      preset: "custom",
    });

    const bucket15 = metrics.dailyBuckets.find((b) => b.date === "2026-06-15");
    const bucket16 = metrics.dailyBuckets.find((b) => b.date === "2026-06-16");

    expect(bucket15).toBeDefined();
    expect(bucket15?.grossRevenue).toBe(115000);
    expect(bucket15?.ordersCount).toBe(1);

    expect(bucket16).toBeDefined();
    expect(bucket16?.grossRevenue).toBe(215000);
    expect(bucket16?.ordersCount).toBe(1);
  });

  it("strictly cross-checks dashboard totals against a raw SQL aggregate over seeded data", async () => {
    // Insert additional orders including paid, shipped, cancelled, and refunded
    const baseDate = new Date("2026-07-01T10:00:00.000Z");

    const sampleAddress = {
      recipientName: "Analytics Customer",
      phone: "081234567890",
      street: "Jl. Analitik No. 1",
      district: "Menteng",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postalCode: "10310",
      country: "Indonesia",
    };

    const [_orderPaid] = await db
      .insert(schema.orders)
      .values({
        storeId,
        orderNumber: `MRC-AGG-PAID-${Date.now()}`,
        guestAccessToken: `token-paid-${Date.now()}`,
        idempotencyKey: `idem-agg-p-${Date.now()}-${Math.random()}`,
        checkoutSessionId: `sess-agg-p-${Date.now()}`,
        status: "paid",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 100000,
        shippingAmount: 15000,
        totalAmount: 115000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: sampleAddress,
        createdAt: baseDate,
        updatedAt: baseDate,
      })
      .returning();

    const [_orderShipped] = await db
      .insert(schema.orders)
      .values({
        storeId,
        orderNumber: `MRC-AGG-SHIP-${Date.now()}`,
        guestAccessToken: `token-ship-${Date.now()}`,
        idempotencyKey: `idem-agg-s-${Date.now()}-${Math.random()}`,
        checkoutSessionId: `sess-agg-s-${Date.now()}`,
        status: "shipped",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 300000,
        shippingAmount: 15000,
        totalAmount: 315000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: sampleAddress,
        createdAt: baseDate,
        updatedAt: baseDate,
      })
      .returning();

    const [_orderCancelled] = await db
      .insert(schema.orders)
      .values({
        storeId,
        orderNumber: `MRC-AGG-CANCEL-${Date.now()}`,
        guestAccessToken: `token-cancel-${Date.now()}`,
        idempotencyKey: `idem-agg-c-${Date.now()}-${Math.random()}`,
        checkoutSessionId: `sess-agg-c-${Date.now()}`,
        status: "cancelled",
        paymentStatus: "unpaid",
        currency: "IDR",
        subtotal: 500000,
        shippingAmount: 15000,
        totalAmount: 515000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: sampleAddress,
        createdAt: baseDate,
        updatedAt: baseDate,
      })
      .returning();

    const [orderRefunded] = await db
      .insert(schema.orders)
      .values({
        storeId,
        orderNumber: `MRC-AGG-REF-${Date.now()}`,
        guestAccessToken: `token-ref-${Date.now()}`,
        idempotencyKey: `idem-agg-r-${Date.now()}-${Math.random()}`,
        checkoutSessionId: `sess-agg-r-${Date.now()}`,
        status: "delivered",
        paymentStatus: "paid",
        currency: "IDR",
        subtotal: 100000,
        shippingAmount: 15000,
        totalAmount: 115000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: sampleAddress,
        createdAt: baseDate,
        updatedAt: baseDate,
      })
      .returning();

    // Create partial refund for orderRefunded
    await db.insert(schema.refunds).values({
      orderId: orderRefunded!.id,
      amount: 45000,
      currency: "IDR",
      reason: "Item discount adjustment refund",
      restocked: false,
      status: "completed",
      createdAt: baseDate,
    });

    const from = new Date("2026-07-01T00:00:00.000Z");
    const to = new Date("2026-07-02T23:59:59.999Z");

    // 1. Fetch metrics via AnalyticsService
    const metrics = await analyticsService.getDashboardMetrics(storeId, {
      from,
      to,
      preset: "custom",
    });

    // 2. Compute direct raw SQL aggregate independently
    const paidStatuses = ["paid", "processing", "shipped", "delivered"];

    const [rawGross] = await db
      .select({
        expectedGross: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::int`,
        expectedCount: sql<number>`COUNT(${schema.orders.id})::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          inArray(schema.orders.status, paidStatuses),
          sql`${schema.orders.createdAt} >= ${from}`,
          sql`${schema.orders.createdAt} <= ${to}`,
        ),
      );

    const [rawRefund] = await db
      .select({
        expectedRefund: sql<number>`COALESCE(SUM(${schema.refunds.amount}), 0)::int`,
      })
      .from(schema.refunds)
      .innerJoin(schema.orders, eq(schema.refunds.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          sql`${schema.refunds.createdAt} >= ${from}`,
          sql`${schema.refunds.createdAt} <= ${to}`,
        ),
      );

    const expectedGrossRevenue = rawGross?.expectedGross ?? 0;
    const expectedPaidOrdersCount = rawGross?.expectedCount ?? 0;
    const expectedRefunds = rawRefund?.expectedRefund ?? 0;
    const expectedNetRevenue = expectedGrossRevenue - expectedRefunds;
    const expectedAov = Math.round(expectedNetRevenue / expectedPaidOrdersCount);

    // Verify mathematical and relational equality
    expect(metrics.grossRevenue).toBe(expectedGrossRevenue);
    expect(metrics.ordersCount).toBe(expectedPaidOrdersCount);
    expect(metrics.totalRefunds).toBe(expectedRefunds);
    expect(metrics.netRevenue).toBe(expectedNetRevenue);
    expect(metrics.aov).toBe(expectedAov);
  });
});
