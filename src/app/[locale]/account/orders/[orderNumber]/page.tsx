import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Clock, MapPin, Package, Receipt, Truck } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { orderService } from "@/modules/orders/service";

interface Props {
  params: Promise<{ locale: string; orderNumber: string }>;
}

export default async function CustomerOrderDetailPage({ params }: Props) {
  const { locale, orderNumber } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/account/orders/${orderNumber}`);
  }

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderNumber, orderNumber))
    .limit(1);

  // Strict IDOR ownership check
  if (!order || order.customerId !== session.user.id) {
    notFound();
  }

  const items = await orderService.getOrderItems(order.id);
  const t = await getTranslations({ locale, namespace: "account" });

  const formattedSubtotal = formatMoney(createMoney(order.subtotal, order.currency));
  const formattedShipping = formatMoney(createMoney(order.shippingAmount, order.currency));
  const formattedTotal = formatMoney(createMoney(order.totalAmount, order.currency));

  // Determine stage progression
  const statusStages = ["paid", "processing", "shipped", "delivered"];
  const currentStageIndex = statusStages.indexOf(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/account/orders`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-base font-bold text-zinc-950">
            {t("orderNumber")} #{order.orderNumber}
          </h2>
          <p className="text-[11px] text-zinc-500">
            {new Date(order.createdAt).toLocaleDateString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {/* Shipping Resi Banner */}
      {order.shippingTrackingNumber && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex items-start gap-3">
          <Truck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-blue-950">
            <div className="font-bold">Informasi Resi Pengiriman</div>
            <p className="text-blue-900">
              Kurir: <strong>{order.shippingCarrier || "Ekspedisi"}</strong> • Nomor Resi:{" "}
              <strong className="font-mono">{order.shippingTrackingNumber}</strong>
            </p>
            {order.shippedAt && (
              <p className="text-[11px] text-blue-800">
                Dikirim pada: {new Date(order.shippedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Fulfillment Status Stepper */}
      {order.status !== "cancelled" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { key: "paid", label: "Dibayar" },
              { key: "processing", label: "Dikemas" },
              { key: "shipped", label: "Dikirim" },
              { key: "delivered", label: "Tiba" },
            ].map((st, idx) => {
              const isPast = currentStageIndex >= idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <div key={st.key} className="space-y-1.5">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isPast ? "bg-emerald-600" : "bg-zinc-200"
                    }`}
                  />
                  <div
                    className={`text-[11px] font-semibold ${
                      isCurrent ? "text-emerald-700" : isPast ? "text-zinc-900" : "text-zinc-400"
                    }`}
                  >
                    {st.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Items */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Package className="h-4 w-4 text-zinc-500" />
              Item Pesanan ({items.length})
            </h3>

            <div className="divide-y divide-zinc-100 text-xs">
              {items.map((item) => (
                <div key={item.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-zinc-900">{item.productName}</div>
                    <div className="text-zinc-500 text-[11px]">{item.variantTitle}</div>
                    <div className="text-zinc-400 text-[11px]">
                      {item.quantity} x {formatMoney(createMoney(item.unitPrice, order.currency))}
                    </div>
                  </div>
                  <div className="font-bold text-zinc-950">
                    {formatMoney(createMoney(item.totalPrice, order.currency))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Address & Summary */}
        <div className="space-y-4">
          {/* Shipping Address */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-2 text-xs">
            <h3 className="font-bold text-zinc-950 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-zinc-500" />
              {t("shippingAddress")}
            </h3>
            <div className="text-zinc-600 leading-relaxed pt-1">
              <p className="font-semibold text-zinc-900">{order.shippingAddress.recipientName}</p>
              <p className="font-mono text-zinc-500">{order.shippingAddress.phone}</p>
              <p className="pt-1">{order.shippingAddress.street}</p>
              <p className="text-zinc-500">
                {order.shippingAddress.district}, {order.shippingAddress.city}
              </p>
              <p className="text-zinc-500">
                {order.shippingAddress.province} {order.shippingAddress.postalCode}
              </p>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-zinc-500" />
              {t("orderSummary")}
            </h3>

            <div className="space-y-1.5 text-zinc-600 pt-1">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span className="font-medium text-zinc-900">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("shipping")}</span>
                <span className="font-medium text-zinc-900">{formattedShipping}</span>
              </div>
              <div className="border-t border-zinc-200 pt-2 flex justify-between font-bold text-sm text-zinc-950">
                <span>{t("total")}</span>
                <span>{formattedTotal}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
