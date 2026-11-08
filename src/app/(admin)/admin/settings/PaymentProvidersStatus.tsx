import { CheckCircle2, CreditCard, XCircle } from "lucide-react";

export function PaymentProvidersStatus() {
  const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || "";
  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
  const midtransIsProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const isMidtransConfigured = Boolean(midtransServerKey && midtransClientKey);

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const isStripeConfigured = Boolean(stripeSecretKey && stripePublishableKey);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-zinc-500" />
          Status Integrasi Gateway Pembayaran (Payment Providers)
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Tinjauan ketersediaan gateway pembayaran. Kunci rahasia tidak pernah ditampilkan pada
          antarmuka pengguna demi keamanan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Midtrans Snap */}
        <div className="rounded-xl border border-zinc-200 p-5 space-y-3 bg-zinc-50/50">
          <div className="flex items-center justify-between">
            <div className="font-bold text-zinc-950 text-sm">Midtrans Snap</div>
            {isMidtransConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Aktif (Enabled)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                <XCircle className="h-3 w-3" />
                Nonaktif (Disabled)
              </span>
            )}
          </div>

          <div className="space-y-2 text-zinc-600">
            <div>
              <span className="font-semibold text-zinc-900">Alasan / Keterangan:</span>
              <p className="mt-0.5 text-zinc-600">
                {isMidtransConfigured
                  ? `Server Key dan Client Key terkonfigurasi untuk mode ${
                      midtransIsProduction ? "Production (Live)" : "Sandbox (Uji Coba)"
                    }. Siap memproses transaksi rupiah (QRIS, VA, GoPay, ShopeePay).`
                  : "Kredensial Server Key atau Client Key belum diisi di environment. Pembayaran metode lokal tidak dapat diproses."}
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 italic">
              Catatan: Variabel MIDTRANS_MERCHANT_ID bersifat opsional dan tidak diwajibkan oleh API
              Midtrans Snap.
            </p>
          </div>
        </div>

        {/* Stripe Checkout */}
        <div className="rounded-xl border border-zinc-200 p-5 space-y-3 bg-zinc-50/50">
          <div className="flex items-center justify-between">
            <div className="font-bold text-zinc-950 text-sm">Stripe Checkout</div>
            {isStripeConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Aktif (Enabled)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                <XCircle className="h-3 w-3" />
                Nonaktif (Disabled)
              </span>
            )}
          </div>

          <div className="space-y-2 text-zinc-600">
            <div>
              <span className="font-semibold text-zinc-900">Alasan / Keterangan:</span>
              <p className="mt-0.5 text-zinc-600">
                {isStripeConfigured
                  ? `Secret Key dan Publishable Key terkonfigurasi untuk mode ${
                      stripeSecretKey.startsWith("sk_live") ? "Live" : "Test"
                    }. Siap memproses pembayaran kartu kredit/debit internasional.`
                  : "Secret Key atau Publishable Key belum dikonfigurasi di environment. Pembayaran internasional dinonaktifkan."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
