import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { AlertCircle, Download, Eye, Filter, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskPhone } from "@/lib/mask";
import { createMoney, formatMoney } from "@/lib/money";
import { hasPermission } from "@/server/guards";

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    needsReview?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/orders");
  }

  if (!hasPermission(session.user.role, "orders:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat daftar pesanan.
      </div>
    );
  }

  const canExport = hasPermission(session.user.role, "orders:export");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const statusFilter = params.status || "all";
  const needsReviewOnly = params.needsReview === "true";
  const fromDate = params.from || "";
  const toDate = params.to || "";
  const sort = params.sort || "newest";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 15;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(schema.orders.status, statusFilter));
  }

  if (needsReviewOnly) {
    conditions.push(eq(schema.orders.paymentStatus, "needs_review"));
  }

  if (fromDate) {
    const d = new Date(fromDate);
    if (!isNaN(d.getTime())) {
      conditions.push(gte(schema.orders.createdAt, d));
    }
  }

  if (toDate) {
    const d = new Date(toDate);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(schema.orders.createdAt, d));
    }
  }

  if (q) {
    const searchWildcard = `%${q}%`;
    conditions.push(
      or(
        ilike(schema.orders.orderNumber, searchWildcard),
        ilike(schema.orders.guestEmail, searchWildcard),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderByClause = desc(schema.orders.createdAt);
  if (sort === "oldest") {
    orderByClause = asc(schema.orders.createdAt);
  } else if (sort === "amount_high") {
    orderByClause = desc(schema.orders.totalAmount);
  } else if (sort === "amount_low") {
    orderByClause = asc(schema.orders.totalAmount);
  }

  const [orders, countRows] = await Promise.all([
    db
      .select()
      .from(schema.orders)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(schema.orders).where(whereClause),
  ]);

  const totalCount = countRows[0]?.count ?? 0;

  const totalPages = Math.ceil(totalCount / pageSize);

  // Build CSV export URL with current query parameters
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (statusFilter && statusFilter !== "all") exportParams.set("status", statusFilter);
  if (needsReviewOnly) exportParams.set("needsReview", "true");
  if (fromDate) exportParams.set("from", fromDate);
  if (toDate) exportParams.set("to", toDate);
  const exportUrl = `/api/admin/orders/export?${exportParams.toString()}`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Pesanan (Orders)</h1>
          <p className="text-sm text-zinc-600">
            Kelola pesanan, proses pemenuhan (fulfillment), dan pantau verifikasi transaksi.
          </p>
        </div>

        {canExport && (
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 shadow-xs transition"
          >
            <Download className="h-4 w-4 text-zinc-500" />
            Ekspor CSV
          </a>
        )}
      </div>

      {/* Filter and Search Bar */}
      <form
        method="GET"
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Keyword Search */}
          <div className="sm:col-span-2">
            <label
              htmlFor="filter-q"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Cari Pesanan
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                id="filter-q"
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Nomor pesanan atau email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label
              htmlFor="filter-status"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Status Pesanan
            </label>
            <select
              id="filter-status"
              name="status"
              defaultValue={statusFilter}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label
              htmlFor="filter-from"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Dari Tanggal
            </label>
            <input
              id="filter-from"
              type="date"
              name="from"
              defaultValue={fromDate}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          {/* Date To */}
          <div>
            <label
              htmlFor="filter-to"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Sampai Tanggal
            </label>
            <input
              id="filter-to"
              type="date"
              name="to"
              defaultValue={toDate}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="filter-sort"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Urutkan
            </label>
            <select
              id="filter-sort"
              name="sort"
              defaultValue={sort}
              className="w-full py-1.5 px-2 text-xs rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="amount_high">Total Tertinggi</option>
              <option value="amount_low">Total Terendah</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            <input
              type="checkbox"
              name="needsReview"
              value="true"
              defaultChecked={needsReviewOnly}
              className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              Tampilkan Hanya &quot;Needs Review&quot; (Pembayaran Telat / Stok Habis)
            </span>
          </label>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/orders"
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Reset Filter
            </Link>
            <button
              type="submit"
              className="px-4 py-1.5 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition"
            >
              Terapkan
            </button>
          </div>
        </div>
      </form>

      {/* Orders Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-3.5">Nomor Pesanan</th>
                <th className="px-6 py-3.5">Tanggal</th>
                <th className="px-6 py-3.5">Pelanggan</th>
                <th className="px-6 py-3.5">Total</th>
                <th className="px-6 py-3.5">Status Pesanan</th>
                <th className="px-6 py-3.5">Status Pembayaran</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                    <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                    Tidak ada pesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const formattedTotal = formatMoney(
                    createMoney(order.totalAmount, order.currency),
                  );
                  const isNeedsReview = order.paymentStatus === "needs_review";
                  const phone = order.shippingAddress?.phone
                    ? maskPhone(order.shippingAddress.phone)
                    : "";

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-zinc-50/50 transition ${
                        isNeedsReview ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-medium text-zinc-950">
                        #{order.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {new Date(order.createdAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-700">
                        <div className="font-medium text-zinc-900">
                          {order.shippingAddress?.recipientName || "Pelanggan"}
                        </div>
                        <div className="text-zinc-500">
                          {order.guestEmail || order.customerId || "-"}
                        </div>
                        {phone && (
                          <div className="text-zinc-400 font-mono text-[11px]">{phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-950">{formattedTotal}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {order.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isNeedsReview ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                            Needs Review
                          </span>
                        ) : order.paymentStatus === "paid" ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Paid
                          </span>
                        ) : order.paymentStatus === "refunded" ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            Refunded
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600">
                            {order.paymentStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition"
                        >
                          <Eye className="h-4 w-4" />
                          Detail
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 text-xs text-zinc-600">
            <div>
              Menampilkan {offset + 1} - {Math.min(offset + pageSize, totalCount)} dari {totalCount}{" "}
              pesanan
            </div>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={{
                    pathname: "/admin/orders",
                    query: { ...params, page: String(page - 1) },
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-medium text-zinc-800 transition"
                >
                  Sebelumnya
                </Link>
              )}
              <span className="font-medium text-zinc-900">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={{
                    pathname: "/admin/orders",
                    query: { ...params, page: String(page + 1) },
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-medium text-zinc-800 transition"
                >
                  Selanjutnya
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
