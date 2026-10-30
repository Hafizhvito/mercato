"use client";

import { CreditCard, ExternalLink, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { createPaymentSessionAction } from "@/modules/payments/actions";

interface PaymentActionCardProps {
  orderId: string;
  amountFormatted: string;
  locale: string;
  initialProvider?: string | null;
}

export function PaymentActionCard({
  orderId,
  amountFormatted,
  locale,
  initialProvider,
}: PaymentActionCardProps) {
  const [selectedProvider, setSelectedProvider] = useState<"midtrans" | "stripe">(
    initialProvider === "stripe" ? "stripe" : "midtrans",
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isId = locale === "id";

  const handlePay = () => {
    setError(null);
    startTransition(async () => {
      try {
        const session = await createPaymentSessionAction(orderId, selectedProvider);
        if (session.redirectUrl) {
          window.location.href = session.redirectUrl;
        } else {
          setError(
            isId
              ? "Tidak dapat mengarahkan ke halaman pembayaran. Silakan coba lagi."
              : "Unable to redirect to payment gateway. Please try again.",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment session creation failed");
      }
    });
  };

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-linear-to-b from-indigo-50/50 to-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-indigo-600" />
        <h3 className="font-bold text-zinc-950 text-base">
          {isId ? "Selesaikan Pembayaran" : "Complete Payment"}
        </h3>
      </div>

      <p className="text-xs text-zinc-600 mb-5 leading-relaxed">
        {isId
          ? "Pesanan Anda telah dicatat. Silakan pilih metode pembayaran yang aman di bawah ini untuk menyelesaikan transaksi."
          : "Your order is reserved. Select a secure payment provider below to proceed with your transaction."}
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Provider Selection */}
      <div className="space-y-3 mb-6">
        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
            selectedProvider === "midtrans"
              ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <input
            type="radio"
            name="paymentProvider"
            value="midtrans"
            checked={selectedProvider === "midtrans"}
            onChange={() => setSelectedProvider("midtrans")}
            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-zinc-700" />
                Midtrans Snap
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {isId ? "Populer di Indonesia" : "Popular in Indonesia"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              QRIS, GoPay, ShopeePay, Virtual Account BCA/Mandiri/BNI/BRI
            </p>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
            selectedProvider === "stripe"
              ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <input
            type="radio"
            name="paymentProvider"
            value="stripe"
            checked={selectedProvider === "stripe"}
            onChange={() => setSelectedProvider("stripe")}
            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-zinc-700" />
                Stripe Checkout
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                Global
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Visa, Mastercard, American Express, JCB (Hosted 3DS2)
            </p>
          </div>
        </label>
      </div>

      {/* Pay Button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 px-4 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isId ? "Menghubungkan ke Pembayaran..." : "Connecting to Gateway..."}
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            {isId ? `Bayar Sekarang (${amountFormatted})` : `Pay Now (${amountFormatted})`}
          </>
        )}
      </button>

      <p className="text-[11px] text-zinc-400 text-center mt-3">
        {isId
          ? "Transaksi diamankan dengan enkripsi 256-bit standar PCI-DSS."
          : "Transactions are secured with 256-bit PCI-DSS compliant encryption."}
      </p>
    </div>
  );
}
