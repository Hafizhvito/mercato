import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskPhone } from "@/lib/mask";
import { assertPermission } from "@/server/guards";

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Neutralize spreadsheet formula injection (OWASP CSV Injection defense)
  // Cells starting with =, +, -, @, tab, or carriage return must be prefixed with '
  if (
    str.startsWith("=") ||
    str.startsWith("+") ||
    str.startsWith("-") ||
    str.startsWith("@") ||
    str.startsWith("\t") ||
    str.startsWith("\r")
  ) {
    str = `'${str}`;
  }

  // Escape inner double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return new NextResponse(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    assertPermission(session.user, "orders:export");
  } catch {
    return new NextResponse(
      JSON.stringify({ error: "Forbidden: orders:export permission required" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const needsReviewParam = searchParams.get("needsReview");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const searchParam = searchParams.get("q");

  const conditions = [];

  if (session.user.storeId) {
    conditions.push(eq(schema.orders.storeId, session.user.storeId));
  }

  if (statusParam && statusParam !== "all") {
    conditions.push(eq(schema.orders.status, statusParam));
  }

  if (needsReviewParam === "true") {
    conditions.push(eq(schema.orders.paymentStatus, "needs_review"));
  }

  if (fromParam) {
    const fromDate = new Date(fromParam);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(schema.orders.createdAt, fromDate));
    }
  }

  if (toParam) {
    const toDate = new Date(toParam);
    if (!Number.isNaN(toDate.getTime())) {
      // Include whole day
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(schema.orders.createdAt, toDate));
    }
  }

  if (searchParam?.trim()) {
    const q = `%${searchParam.trim()}%`;
    conditions.push(or(ilike(schema.orders.orderNumber, q), ilike(schema.orders.guestEmail, q)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orders = await db
    .select()
    .from(schema.orders)
    .where(whereClause)
    .orderBy(desc(schema.orders.createdAt))
    .limit(1000);

  const csvRows: string[] = [];

  // Header row
  const headersList = [
    "Order Number",
    "Date",
    "Status",
    "Payment Status",
    "Payment Provider",
    "Customer Email",
    "Recipient Name",
    "Phone",
    "City",
    "Province",
    "Shipping Carrier",
    "Tracking Number",
    "Subtotal (Minor)",
    "Shipping (Minor)",
    "Total (Minor)",
    "Currency",
  ];
  csvRows.push(headersList.map(escapeCsvCell).join(","));

  for (const order of orders) {
    const addr = order.shippingAddress || ({} as Record<string, unknown>);
    csvRows.push(
      [
        order.orderNumber,
        new Date(order.createdAt).toISOString(),
        order.status,
        order.paymentStatus,
        order.paymentProvider || "",
        order.guestEmail || order.customerId || "",
        addr.recipientName || "",
        addr.phone ? maskPhone(String(addr.phone)) : "",
        addr.city || "",
        addr.province || "",
        order.shippingCarrier || "",
        order.shippingTrackingNumber || "",
        order.subtotal,
        order.shippingAmount,
        order.totalAmount,
        order.currency,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  const csvContent = `\uFEFF${csvRows.join("\r\n")}`; // UTF-8 BOM for Excel compatibility
  const filename = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
