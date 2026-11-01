import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
  preset: "7d" | "30d" | "custom";
}

export interface DailyRevenueBucket {
  date: string; // YYYY-MM-DD
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  ordersCount: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  unitsSold: number;
  totalRevenue: number;
}

export interface LowStockVariant {
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  availableStock: number;
  physicalStock: number;
}

export interface DashboardMetrics {
  grossRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  ordersCount: number;
  aov: number;
  statusDistribution: StatusCount[];
  dailyBuckets: DailyRevenueBucket[];
  topProducts: TopProduct[];
  lowStockItems: LowStockVariant[];
  dateRange: AnalyticsDateRange;
}

export class AnalyticsService {
  /**
   * Computes comprehensive operational and financial metrics for the merchant dashboard.
   * All date bucketing enforces 'Asia/Jakarta' (WIB / UTC+7) timezone semantics.
   */
  async getDashboardMetrics(
    storeId: string,
    range: { from: Date; to: Date; preset?: "7d" | "30d" | "custom" },
  ): Promise<DashboardMetrics> {
    const { from, to, preset = "30d" } = range;
    const paidStatuses = ["paid", "processing", "shipped", "delivered"];

    // 1. Gross Revenue & Orders Count
    const [revenueSummary] = await db
      .select({
        grossRevenue: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::int`,
        paidOrdersCount: sql<number>`COUNT(${schema.orders.id})::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          inArray(schema.orders.status, paidStatuses),
          gte(schema.orders.createdAt, from),
          lte(schema.orders.createdAt, to),
        ),
      );

    const grossRevenue = revenueSummary?.grossRevenue ?? 0;
    const ordersCount = revenueSummary?.paidOrdersCount ?? 0;

    // 2. Total Refunds
    const [refundSummary] = await db
      .select({
        totalRefunds: sql<number>`COALESCE(SUM(${schema.refunds.amount}), 0)::int`,
      })
      .from(schema.refunds)
      .innerJoin(schema.orders, eq(schema.refunds.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          gte(schema.refunds.createdAt, from),
          lte(schema.refunds.createdAt, to),
        ),
      );

    const totalRefunds = refundSummary?.totalRefunds ?? 0;
    const netRevenue = Math.max(0, grossRevenue - totalRefunds);
    const aov = ordersCount > 0 ? Math.round(netRevenue / ordersCount) : 0;

    // 3. Orders by Status Distribution
    const statusRows = await db
      .select({
        status: schema.orders.status,
        count: sql<number>`COUNT(${schema.orders.id})::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          gte(schema.orders.createdAt, from),
          lte(schema.orders.createdAt, to),
        ),
      )
      .groupBy(schema.orders.status);

    const statusDistribution: StatusCount[] = statusRows.map((r) => ({
      status: r.status,
      count: r.count,
    }));

    // 4. Daily Revenue Breakdown (Asia/Jakarta bucketing)
    const dailyRows = await db
      .select({
        dateStr: sql<string>`TO_CHAR(${schema.orders.createdAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`,
        dailyRevenue: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)::int`,
        dailyOrders: sql<number>`COUNT(${schema.orders.id})::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          inArray(schema.orders.status, paidStatuses),
          gte(schema.orders.createdAt, from),
          lte(schema.orders.createdAt, to),
        ),
      )
      .groupBy(sql`TO_CHAR(${schema.orders.createdAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`)
      .orderBy(
        sql`TO_CHAR(${schema.orders.createdAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') ASC`,
      );

    const dailyBuckets: DailyRevenueBucket[] = dailyRows.map((r) => ({
      date: r.dateStr,
      grossRevenue: r.dailyRevenue,
      refundAmount: 0,
      netRevenue: r.dailyRevenue,
      ordersCount: r.dailyOrders,
    }));

    // 5. Top Selling Products
    const topRows = await db
      .select({
        productId: schema.orderItems.productId,
        productName: schema.orderItems.productName,
        unitsSold: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(${schema.orderItems.totalPrice}), 0)::int`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.storeId, storeId),
          inArray(schema.orders.status, paidStatuses),
          gte(schema.orders.createdAt, from),
          lte(schema.orders.createdAt, to),
        ),
      )
      .groupBy(schema.orderItems.productId, schema.orderItems.productName)
      .orderBy(desc(sql`SUM(${schema.orderItems.quantity})`))
      .limit(5);

    const topProducts: TopProduct[] = topRows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      unitsSold: r.unitsSold,
      totalRevenue: r.totalRevenue,
    }));

    // 6. Low Stock Alert Variants
    const now = new Date();
    const [store] = await db
      .select({ lowStockThreshold: schema.stores.lowStockThreshold })
      .from(schema.stores)
      .where(eq(schema.stores.id, storeId))
      .limit(1);

    const threshold = store?.lowStockThreshold ?? 5;

    const variantRows = await db
      .select({
        variantId: schema.productVariants.id,
        sku: schema.productVariants.sku,
        variantTitle: schema.productVariants.title,
        physicalStock: schema.productVariants.stock,
        productName: schema.products.name,
        activeReservations: sql<number>`
          COALESCE(
            (SELECT SUM(sr.quantity)
             FROM ${schema.stockReservations} sr
             WHERE sr.variant_id = ${schema.productVariants.id}
               AND sr.status = 'active'
               AND sr.reserved_until >= ${now}),
            0
          )::int
        `,
      })
      .from(schema.productVariants)
      .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
      .where(eq(schema.products.storeId, storeId))
      .orderBy(schema.productVariants.stock)
      .limit(20);

    const lowStockItems: LowStockVariant[] = variantRows
      .map((v) => ({
        variantId: v.variantId,
        sku: v.sku,
        variantTitle: v.variantTitle,
        productName: v.productName,
        physicalStock: v.physicalStock,
        availableStock: Math.max(0, v.physicalStock - v.activeReservations),
      }))
      .filter((v) => v.availableStock <= threshold)
      .slice(0, 5);

    return {
      grossRevenue,
      totalRefunds,
      netRevenue,
      ordersCount,
      aov,
      statusDistribution,
      dailyBuckets,
      topProducts,
      lowStockItems,
      dateRange: { from, to, preset },
    };
  }
}

export const analyticsService = new AnalyticsService();
