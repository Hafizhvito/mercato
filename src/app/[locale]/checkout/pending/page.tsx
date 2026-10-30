import { Clock, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/storefront/Header";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    orderNumber?: string;
    token?: string;
    order_id?: string;
  }>;
}

export const instant = false;

export default async function CheckoutPendingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const search = await searchParams;
  const orderNumber = search.orderNumber || search.order_id || "";
  const token = search.token || "";

  const isId = locale === "id";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-8 shadow-xs text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-6">
            <Clock className="h-10 w-10" />
          </div>

          <h1 className="text-2xl font-black text-zinc-950">
            {isId ? "Menunggu Pembayaran" : "Awaiting Payment"}
          </h1>

          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            {isId
              ? "Transaksi Anda sedang diproses atau menunggu transfer. Silakan selesaikan pembayaran sesuai instruksi penyedia pembayaran Anda."
              : "Your payment is pending or awaiting bank transfer. Please follow the instructions provided by your payment method to complete the transaction."}
          </p>

          {orderNumber && (
            <div className="mt-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
              <span className="text-zinc-500 uppercase tracking-wider font-semibold">
                {isId ? "Nomor Pesanan" : "Order Number"}
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
                <RefreshCw className="h-4 w-4" />
                {isId ? "Cek Status Pesanan" : "Check Order Status"}
              </Link>
            )}

            <Link
              href={`/${locale}/catalog`}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-3 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              <ExternalLink className="h-4 w-4" />
              {isId ? "Kembali ke Katalog" : "Back to Catalog"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
