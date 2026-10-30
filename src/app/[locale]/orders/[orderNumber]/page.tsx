import { CheckCircle2, Clock, Package, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/storefront/Header";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { orderService } from "@/modules/orders/service";

export const instant = false;

interface Props {
  params: Promise<{
    locale: string;
    orderNumber: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order #${orderNumber} | Mercato`,
    description: `Order confirmation details for order #${orderNumber} on Mercato.`,
  };
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { locale, orderNumber } = await params;

  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) notFound();

  const order = await orderService.getOrderByNumber(orderNumber, store.id);
  if (!order) notFound();

  const [items, history] = await Promise.all([
    orderService.getOrderItems(order.id),
    orderService.getOrderStatusHistory(order.id),
  ]);

  const formattedSubtotal = formatMoney(createMoney(order.subtotal, order.currency));
  const formattedShipping = formatMoney(createMoney(order.shippingAmount, order.currency));
  const formattedDiscount = formatMoney(createMoney(order.discountAmount, order.currency));
  const formattedTotal = formatMoney(createMoney(order.totalAmount, order.currency));

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-xs text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Order Confirmed
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
              Order #{order.orderNumber}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {locale === "id"
                ? "Terima kasih atas pesanan Anda. Kami telah mencatat pesanan Anda dan menunggu pembayaran."
                : "Thank you for your order. We have recorded your purchase and are awaiting payment."}
            </p>

            {/* Status Badge */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
              <Clock className="h-4 w-4" />
              <span>
                Status: <strong className="uppercase">{order.status.replace("_", " ")}</strong>
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Items Details */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs md:col-span-2 space-y-6">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-zinc-500" />
                Purchased Items ({items.length})
              </h2>

              <div className="divide-y divide-zinc-200">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex justify-between items-center text-sm">
                    <div>
                      <h4 className="font-semibold text-zinc-900">{item.productName}</h4>
                      <p className="text-xs text-zinc-500">{item.variantTitle}</p>
                      <p className="text-[11px] text-zinc-400">
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

              {/* Order Calculations */}
              <div className="border-t border-zinc-200 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-zinc-900">{formattedSubtotal}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>
                    Shipping ({order.shippingCarrier} - {order.shippingService})
                  </span>
                  <span className="font-medium text-zinc-900">{formattedShipping}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount</span>
                    <span>-{formattedDiscount}</span>
                  </div>
                )}
                <div className="border-t border-zinc-200 pt-3 flex justify-between text-sm font-bold text-zinc-950">
                  <span>Total Amount</span>
                  <span>{formattedTotal}</span>
                </div>
              </div>
            </div>

            {/* Shipping Info Card */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-zinc-500" />
                  Shipping Address
                </h3>
                <div className="text-xs text-zinc-600 space-y-1">
                  <p className="font-semibold text-zinc-900">
                    {order.shippingAddress.recipientName}
                  </p>
                  <p>{order.shippingAddress.phone}</p>
                  <p>{order.shippingAddress.street}</p>
                  <p>
                    {order.shippingAddress.district}, {order.shippingAddress.city}
                  </p>
                  <p>
                    {order.shippingAddress.province} {order.shippingAddress.postalCode}
                  </p>
                  <p className="font-medium text-zinc-700">{order.shippingAddress.country}</p>
                </div>
              </div>

              {/* Status History Timeline */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                <h3 className="text-sm font-bold text-zinc-900 mb-3">Order History</h3>
                <div className="space-y-3">
                  {history.map((event) => (
                    <div key={event.id} className="border-l-2 border-zinc-300 pl-3 py-0.5 text-xs">
                      <p className="font-semibold uppercase tracking-wider text-zinc-800">
                        {event.toStatus.replace("_", " ")}
                      </p>
                      {event.reason && <p className="text-zinc-500">{event.reason}</p>}
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {new Date(event.createdAt).toLocaleString(
                          locale === "id" ? "id-ID" : "en-US",
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <Link
                  href={`/${locale}/catalog`}
                  className="inline-block rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
