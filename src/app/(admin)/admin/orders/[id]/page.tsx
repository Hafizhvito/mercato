import { desc, eq } from "drizzle-orm";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  History,
  Package,
  RotateCcw,
  Truck,
  User,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskPhone } from "@/lib/mask";
import { createMoney, formatMoney } from "@/lib/money";
import { orderService } from "@/modules/orders/service";
import { assertStoreAccess, hasPermission } from "@/server/guards";
import { AdminCancelUnpaidButton } from "./AdminCancelUnpaidButton";
import { AdminFulfillmentForm } from "./AdminFulfillmentForm";
import { AdminLatePaymentResolution } from "./AdminLatePaymentResolution";
import { AdminNotesForm } from "./AdminNotesForm";
import { AdminRefundForm } from "./AdminRefundForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/orders");
  }

  if (!hasPermission(session.user.role, "orders:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat detail pesanan ini.
      </div>
    );
  }

  const canRefund = hasPermission(session.user.role, "orders:refund");
  const canViewAudit = hasPermission(session.user.role, "audit_log:view");

  const { id } = await params;

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);

  if (!order) {
    notFound();
  }

  try {
    assertStoreAccess(session.user, order.storeId);
  } catch {
    notFound();
  }

  const [items, history, notes, refunds, auditLogs] = await Promise.all([
    orderService.getOrderItems(order.id),
    orderService.getOrderStatusHistory(order.id),
    db
      .select()
      .from(schema.orderNotes)
      .where(eq(schema.orderNotes.orderId, order.id))
      .orderBy(desc(schema.orderNotes.createdAt)),
    db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.orderId, order.id))
      .orderBy(desc(schema.refunds.createdAt)),
    canViewAudit
      ? db
          .select()
          .from(schema.auditLogs)
          .where(eq(schema.auditLogs.entityId, order.id))
          .orderBy(schema.auditLogs.createdAt)
      : Promise.resolve([]),
  ]);

  const formattedSubtotal = formatMoney(createMoney(order.subtotal, order.currency));
  const formattedShipping = formatMoney(createMoney(order.shippingAmount, order.currency));
  const formattedTotal = formatMoney(createMoney(order.totalAmount, order.currency));
  const isNeedsReview = order.paymentStatus === "needs_review";
  const isUnpaid = order.status === "awaiting_payment" || order.status === "pending";

  const maskedPhone = order.shippingAddress?.phone ? maskPhone(order.shippingAddress.phone) : "-";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/orders"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              Pesanan #{order.orderNumber}
            </h1>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
              {order.status.replace("_", " ")}
            </span>
            {isNeedsReview && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <AlertCircle className="h-3 w-3 text-amber-700" />
                Needs Review
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Dibuat pada{" "}
            {new Date(order.createdAt).toLocaleString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {/* Needs Review Resolution Banner */}
      {isNeedsReview && <AdminLatePaymentResolution orderId={order.id} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Items, Timeline, Notes, Refunds */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
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
                  Ongkos Kirim ({order.shippingCarrier || "Kurir"} -{" "}
                  {order.shippingService || "Standar"})
                </span>
                <span className="font-medium text-zinc-900">{formattedShipping}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Potongan Diskon</span>
                  <span className="font-medium">
                    -{formatMoney(createMoney(order.discountAmount, order.currency))}
                  </span>
                </div>
              )}
              {order.taxAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Pajak (PPN)</span>
                  <span className="font-medium text-zinc-900">
                    {formatMoney(createMoney(order.taxAmount, order.currency))}
                  </span>
                </div>
              )}
              {order.shippingTrackingNumber && (
                <div className="flex justify-between text-zinc-600 font-mono">
                  <span>Nomor Resi</span>
                  <span className="font-semibold text-zinc-900">
                    {order.shippingTrackingNumber}
                  </span>
                </div>
              )}
              <div className="border-t border-zinc-200 pt-3 flex justify-between text-sm font-bold text-zinc-950">
                <span>Total Transaksi</span>
                <span>{formattedTotal}</span>
              </div>
            </div>
          </div>

          {/* Internal Staff Notes */}
          <AdminNotesForm orderId={order.id} initialNotes={notes} />

          {/* Refund History (if any refunds exist) */}
          {refunds.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-purple-600" />
                Riwayat Pengembalian Dana (Refunds)
              </h2>
              <div className="divide-y divide-zinc-100">
                {refunds.map((ref) => (
                  <div key={ref.id} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-zinc-900">
                        {formatMoney(createMoney(ref.amount, ref.currency))} •{" "}
                        <span className="uppercase text-purple-700 font-mono text-[10px] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          {ref.status}
                        </span>
                      </p>
                      <p className="text-zinc-600 text-[11px] mt-0.5">{ref.reason}</p>
                      {ref.providerRefundId && (
                        <p className="text-zinc-400 font-mono text-[10px]">
                          ID Gateway: {ref.providerRefundId}
                        </p>
                      )}
                    </div>
                    <span className="text-zinc-400 text-[11px]">
                      {new Date(ref.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Audit Logs (Owner/Admin only) */}
          {canViewAudit && auditLogs.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-zinc-500" />
                Audit Log & Riwayat Sistem
              </h2>
              <div className="space-y-3">
                {auditLogs.map((log) => (
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
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Customer Details & Operation Actions */}
        <div className="space-y-6">
          {/* Customer & Shipping Details */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-500" />
              Informasi Pelanggan
            </h3>
            <div className="text-xs text-zinc-600 space-y-1">
              <p className="font-semibold text-zinc-900">{order.shippingAddress?.recipientName}</p>
              <p>{order.guestEmail || order.customerId || "Tanpa email"}</p>
              <p className="font-mono text-zinc-500">Telepon: {maskedPhone}</p>
            </div>

            <hr className="border-zinc-200" />

            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Truck className="h-4 w-4 text-zinc-500" />
              Alamat Pengiriman
            </h3>
            <div className="text-xs text-zinc-600 space-y-1">
              <p>{order.shippingAddress?.street}</p>
              <p>
                {order.shippingAddress?.district}, {order.shippingAddress?.city}
              </p>
              <p>
                {order.shippingAddress?.province} {order.shippingAddress?.postalCode}
              </p>
            </div>
          </div>

          {/* Fulfillment Action Form */}
          {order.status !== "awaiting_payment" && (
            <AdminFulfillmentForm
              orderId={order.id}
              currentStatus={order.status}
              existingCarrier={order.shippingCarrier}
              existingTrackingNumber={order.shippingTrackingNumber}
            />
          )}

          {/* Unpaid Cancel Action */}
          {isUnpaid && (
            <AdminCancelUnpaidButton orderId={order.id} orderNumber={order.orderNumber} />
          )}

          {/* Refund Action Form (Available for paid / processing / shipped orders) */}
          {(order.status === "paid" ||
            order.status === "processing" ||
            order.status === "shipped") && (
            <AdminRefundForm
              orderId={order.id}
              orderNumber={order.orderNumber}
              totalAmountMinor={order.totalAmount}
              currency={order.currency}
              isNeedsReview={isNeedsReview}
              canRefund={canRefund}
            />
          )}
        </div>
      </div>
    </div>
  );
}
