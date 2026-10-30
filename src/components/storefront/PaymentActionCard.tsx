"use client";

import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState, useTransition } from "react";
import { checkPaymentStatusAction, createPaymentSessionAction } from "@/modules/payments/actions";

interface PaymentActionCardProps {
  orderId: string;
  orderNumber: string;
  token?: string;
  amountFormatted: string;
  locale: string;
  initialProvider?: string | null;
  availableProviders?: ("midtrans" | "stripe")[];
  paymentStatus?: string;
}

export function PaymentActionCard({
  orderId,
  orderNumber,
  token,
  amountFormatted,
  locale,
  initialProvider,
  availableProviders = ["midtrans", "stripe"],
  paymentStatus,
}: PaymentActionCardProps) {
  const defaultProvider = availableProviders.includes(initialProvider as "midtrans" | "stripe")
    ? (initialProvider as "midtrans" | "stripe")
    : (availableProviders[0] ?? "midtrans");

  const [selectedProvider, setSelectedProvider] = useState<"midtrans" | "stripe">(defaultProvider);
  const [isPending, startTransition] = useTransition();
  const [isCheckingStatus, startStatusCheck] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isId = locale === "id";

  const handlePay = () => {
    setError(null);
    setStatusMessage(null);
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

  const handleCheckStatus = () => {
    setError(null);
    setStatusMessage(null);
    startStatusCheck(async () => {
      try {
        const result = await checkPaymentStatusAction({ orderNumber, token, locale });
        if (result.success) {
          setStatusMessage(
            isId
              ? `Status terkini: ${result.status} (Pembayaran: ${result.paymentStatus})`
              : `Current status: ${result.status} (Payment: ${result.paymentStatus})`,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status check failed");
      }
    });
  };

  if (paymentStatus === "needs_review") {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <h3 className="font-bold text-zinc-950 text-base">
            {isId ? "Pesanan Dalam Peninjauan" : "Order Under Review"}
          </h3>
        </div>
        <p className="text-xs text-zinc-700 leading-relaxed">
          {isId
            ? "Pembayaran Anda telah diterima, namun pesanan ini membutuhkan verifikasi ketersediaan stok oleh admin kami. Tim kami akan segera menghubungi Anda."
            : "Your payment has been received, but this order requires stock verification by our merchant team. We will contact you shortly."}
        </p>
        <button
          type="button"
          onClick={handleCheckStatus}
          disabled={isCheckingStatus}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white py-2 px-3 text-xs font-semibold text-zinc-800 hover:bg-amber-100/50 transition disabled:opacity-50"
        >
          {isCheckingStatus ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {isId ? "Periksa Pembaruan Status" : "Check for Status Updates"}
        </button>
      </div>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-xs text-center space-y-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h4 className="font-bold text-zinc-950 text-sm">
          {isId ? "Kanal Pembayaran Belum Tersedia" : "No Payment Methods Configured"}
        </h4>
        <p className="text-xs text-zinc-600 leading-relaxed">
          {isId
            ? "Saat ini belum ada gateway pembayaran yang aktif. Silakan hubungi admin toko untuk bantuan pembayaran pesanan Anda."
            : "No automated payment gateway is currently enabled. Please contact store administration for assistance with your order."}
        </p>
      </div>
    );
  }

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
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Provider Selection (only showing enabled providers) */}
      <div className="space-y-3 mb-6">
        {availableProviders.includes("midtrans") && (
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
        )}

        {availableProviders.includes("stripe") && (
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
        )}
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

      {/* Sync Status Button */}
      <button
        type="button"
        onClick={handleCheckStatus}
        disabled={isCheckingStatus}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition"
      >
        {isCheckingStatus ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
            {isId ? "Memeriksa Status..." : "Checking Status..."}
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
            {isId ? "Periksa Status Pembayaran" : "Check Payment Status"}
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
