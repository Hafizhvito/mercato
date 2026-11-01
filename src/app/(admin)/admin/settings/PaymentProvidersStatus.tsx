import { CheckCircle2, CreditCard, XCircle } from "lucide-react";

export function PaymentProvidersStatus() {
  const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || "";
  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
  const midtransMerchantId = process.env.MIDTRANS_MERCHANT_ID || "";
  const midtransIsProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  const isMidtransConfigured = Boolean(midtransServerKey && midtransClientKey);

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const isStripeConfigured = Boolean(stripeSecretKey && stripePublishableKey);

  // Masking helpers - strictly show only prefixes and asterisks
  const maskKey = (key: string, prefixLen = 8) => {
    if (!key) return "Belum Dikonfigurasi";
    const prefix = key.slice(0, prefixLen);
    return `${prefix}************************`;
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-zinc-500" />
          Status Integrasi Gateway Pembayaran (Payment Providers)
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Tinjauan read-only status kredensial gateway. Kunci rahasia (secret keys) disamarkan untuk
          keamanan.
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
                Aktif & Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                <XCircle className="h-3 w-3" />
                Tidak Aktif
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-zinc-600">
            <div className="flex justify-between">
              <span>Mode Operasi:</span>
              <span className="font-semibold text-zinc-900">
                {midtransIsProduction ? "Production (Live)" : "Sandbox (Uji Coba)"}
              </span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Merchant ID:</span>
              <span className="text-zinc-900">{midtransMerchantId || "G-MIDTRANS-DEFAULT"}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Client Key:</span>
              <span className="text-zinc-700">{maskKey(midtransClientKey, 14)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Server Key:</span>
              <span className="text-zinc-700">{maskKey(midtransServerKey, 14)}</span>
            </div>
          </div>
        </div>

        {/* Stripe Checkout */}
        <div className="rounded-xl border border-zinc-200 p-5 space-y-3 bg-zinc-50/50">
          <div className="flex items-center justify-between">
            <div className="font-bold text-zinc-950 text-sm">Stripe Checkout</div>
            {isStripeConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Aktif & Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                <XCircle className="h-3 w-3" />
                Tidak Dikonfigurasi
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-zinc-600">
            <div className="flex justify-between">
              <span>Mode Operasi:</span>
              <span className="font-semibold text-zinc-900">
                {stripeSecretKey.startsWith("sk_live") ? "Live" : "Test"}
              </span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Publishable Key:</span>
              <span className="text-zinc-700">{maskKey(stripePublishableKey, 10)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Secret Key:</span>
              <span className="text-zinc-700">{maskKey(stripeSecretKey, 10)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
