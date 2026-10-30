import { AlertCircle, Eye, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";

export default async function AdminOrdersPage() {
  const allOrders = await db.select().from(schema.orders).orderBy(schema.orders.createdAt);

  // Group or reverse for display
  const orders = allOrders.reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Pesanan (Orders)</h1>
          <p className="text-sm text-zinc-600">
            Kelola pesanan pelanggan, status pembayaran, dan peninjauan manual transaksi.
          </p>
        </div>
      </div>

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
                    Belum ada pesanan yang tercatat.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const formattedTotal = formatMoney(
                    createMoney(order.totalAmount, order.currency),
                  );
                  const isNeedsReview = order.paymentStatus === "needs_review";

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
                        {order.guestEmail || order.customerId || "Pelanggan Guest"}
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
                          Lihat
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
