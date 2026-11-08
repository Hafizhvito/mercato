import { desc, eq } from "drizzle-orm";
import { Eye, ShoppingBag } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";

export const instant = false;

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountOrdersPage({ params }: Props) {
  const { locale } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  const orders = session?.user?.id
    ? await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.customerId, session.user.id))
        .orderBy(desc(schema.orders.createdAt))
    : [];

  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-950">{t("ordersTab")}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{t("ordersDesc")}</p>
      </div>

      {orders.length === 0 ? (
        <div className="py-12 text-center text-zinc-400 space-y-2">
          <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="text-xs">{t("noOrders")}</p>
          <Link
            href={`/${locale}/catalog`}
            className="inline-block mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            {t("startShopping")}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200">
          {orders.map((order) => {
            const formattedTotal = formatMoney(createMoney(order.totalAmount, order.currency));

            return (
              <div
                key={order.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-950 text-sm">
                      #{order.orderNumber}
                    </span>
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                      {order.status.replace("_", " ")}
                    </span>
                    {order.paymentStatus === "paid" && (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t("paidBadge")}
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-500">
                    {new Date(order.createdAt).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                  {order.shippingTrackingNumber && (
                    <div className="text-zinc-600 font-mono text-[11px]">
                      {order.shippingCarrier}: {order.shippingTrackingNumber}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <div className="text-[11px] text-zinc-500">{t("orderTotal")}</div>
                    <div className="font-bold text-zinc-950 text-sm">{formattedTotal}</div>
                  </div>

                  <Link
                    href={`/${locale}/account/orders/${order.orderNumber}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-800 hover:bg-zinc-50 transition"
                  >
                    <Eye className="h-3.5 w-3.5 text-zinc-500" />
                    {t("viewOrder")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
