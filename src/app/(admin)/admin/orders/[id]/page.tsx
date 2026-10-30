import { eq } from "drizzle-orm";
import { AlertCircle, ArrowLeft, Clock, History, Package, Truck, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { orderService } from "@/modules/orders/service";
import { AdminRefundForm } from "./AdminRefundForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);

  if (!order) {
    notFound();
  }

  const [items, history, auditLogs] = await Promise.all([
    orderService.getOrderItems(order.id),
    orderService.getOrderStatusHistory(order.id),
    db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, order.id))
      .orderBy(schema.auditLogs.createdAt),
  ]);

  const formattedSubtotal = formatMoney(createMoney(order.subtotal, order.currency));
  const formattedShipping = formatMoney(createMoney(order.shippingAmount, order.currency));
  const formattedTotal = formatMoney(createMoney(order.totalAmount, order.currency));
  const isNeedsReview = order.paymentStatus === "needs_review";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/orders"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Pesanan #{order.orderNumber}
          </h1>
          <p className="text-xs text-zinc-500">
            Dibuat pada{" "}
            {new Date(order.createdAt).toLocaleString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {isNeedsReview && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 shadow-xs flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-950">
              Perlu Peninjauan Manual (Late Payment / Out of Stock)
            </h3>
            <p className="text-xs text-amber-900 leading-relaxed">
              Pembayaran untuk pesanan ini berhasil diterima via gateway{" "}
              <strong>{order.paymentProvider?.toUpperCase()}</strong>, namun reservasi batas waktu
              checkout telah kedaluwarsa dan stok produk saat ini telah habis.
            </p>
            <p className="text-xs text-amber-900 font-medium">
              Tindakan: Restock dan penuhi pesanan secara manual, atau lakukan pengembalian dana
              (refund) kepada pelanggan di bawah ini.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Line Items & Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-zinc-500" />
              Item Pesanan ({items.length})
            </h2>
            <div className="divide-y divide-zinc-200">
              {items.map((item) => (
                <div key={item.id} className="py-3.5 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.productName}</p>
                    <p className="text-xs text-zinc-500">{item.variantTitle}</p>
                    <p className="text-xs text-zinc-400">
                      SKU: {item.sku} • {item.quantity} x{" "}
                      {formatMoney(createMoney(item.unitPrice, order.currency))}
                    </p>
                  </div>
                  <span className="font-bold text-zinc-950">
                    {formatMoney(createMoney(item.totalPrice, order.currency))}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 pt-4 mt-2 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-medium text-zinc-900">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>
                  Ongkos Kirim ({order.shippingCarrier} - {order.shippingService})
                </span>
                <span className="font-medium text-zinc-900">{formattedShipping}</span>
              </div>
              <div className="border-t border-zinc-200 pt-3 flex justify-between text-sm font-bold text-zinc-950">
                <span>Total Transaksi</span>
                <span>{formattedTotal}</span>
              </div>
            </div>
          </div>

          {/* Status Transitions Timeline */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              Riwayat Transisi Status
            </h2>
            <div className="space-y-3">
              {history.map((event) => (
                <div key={event.id} className="border-l-2 border-zinc-300 pl-3 py-1 text-xs">
                  <p className="font-semibold uppercase tracking-wider text-zinc-900">
                    {event.fromStatus ? `${event.fromStatus} → ` : ""}
                    {event.toStatus}
                  </p>
                  <p className="text-zinc-600 mt-0.5">
                    {event.reason ?? "Pembaruan status otomatis"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {new Date(event.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-500" />
              Audit Log & Riwayat Sistem
            </h2>
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">Belum ada audit log.</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-zinc-900 font-mono">{log.action}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(log.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <p className="text-zinc-600">
                      Pengguna:{" "}
                      <span className="font-medium text-zinc-800">
                        {log.userId || "Sistem / Otomatis"}
                      </span>
                    </p>
                    {log.details && (
                      <pre className="mt-1.5 p-2 bg-white rounded border border-zinc-200 text-[11px] text-zinc-700 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customer Details & Actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-500" />
              Informasi Pelanggan
            </h3>
            <div className="text-xs text-zinc-600 space-y-1">
              <p className="font-medium text-zinc-900">{order.shippingAddress.recipientName}</p>
              <p>{order.guestEmail || "No guest email"}</p>
              <p>{order.shippingAddress.phone}</p>
            </div>

            <hr className="border-zinc-200" />

            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Truck className="h-4 w-4 text-zinc-500" />
              Alamat Pengiriman
            </h3>
            <div className="text-xs text-zinc-600 space-y-1">
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.district}, {order.shippingAddress.city}
              </p>
              <p>
                {order.shippingAddress.province} {order.shippingAddress.postalCode}
              </p>
            </div>
          </div>

          {/* Refund Action Form */}
          <AdminRefundForm
            orderId={order.id}
            orderNumber={order.orderNumber}
            totalAmountMinor={order.totalAmount}
            currency={order.currency}
            isNeedsReview={isNeedsReview}
          />
        </div>
      </div>
    </div>
  );
}
