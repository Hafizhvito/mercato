import { CheckCircle2, ChevronRight, PackageCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/storefront/Header";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    orderNumber?: string;
    token?: string;
    order_id?: string;
  }>;
}

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const search = await searchParams;
  const orderNumber = search.orderNumber || search.order_id || "";
  const token = search.token || "";

  const t = await getTranslations({ locale, namespace: "order" });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-8 shadow-xs text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <h1 className="text-2xl font-black text-zinc-950">{t("paymentSuccessTitle")}</h1>

          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{t("paymentSuccessDesc")}</p>

          {orderNumber && (
            <div className="mt-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
              <span className="text-zinc-500 uppercase tracking-wider font-semibold">
                {t("orderNumber")}
              </span>
              <p className="mt-1 text-base font-bold text-zinc-950 font-mono">#{orderNumber}</p>
            </div>
          )}

          <div className="mt-8 space-y-3">
            {orderNumber && (
              <Link
                href={`/${locale}/orders/${orderNumber}${token ? `?token=${token}` : ""}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 py-3 px-4 text-xs font-semibold text-white hover:bg-zinc-800 transition"
              >
                <PackageCheck className="h-4 w-4" />
                {t("viewOrder")}
              </Link>
            )}

            <Link
              href={`/${locale}/catalog`}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-3 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              {t("continueShopping")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
