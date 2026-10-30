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
import { useTranslations } from "next-intl";
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
  const t = useTranslations("payment");

  const defaultProvider = availableProviders.includes(initialProvider as "midtrans" | "stripe")
    ? (initialProvider as "midtrans" | "stripe")
    : (availableProviders[0] ?? "midtrans");

  const [selectedProvider, setSelectedProvider] = useState<"midtrans" | "stripe">(defaultProvider);
  const [isPending, startTransition] = useTransition();
  const [isCheckingStatus, startStatusCheck] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handlePay = () => {
    setError(null);
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const session = await createPaymentSessionAction(orderId, selectedProvider);
        if (session.redirectUrl) {
          window.location.href = session.redirectUrl;
        } else {
          setError(t("redirectError"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("sessionFailed"));
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
            t("statusCheckSuccess", {
              status: result.status,
              paymentStatus: result.paymentStatus,
            }),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("statusCheckFailed"));
      }
    });
  };

  if (paymentStatus === "needs_review") {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <h3 className="font-bold text-zinc-950 text-base">{t("orderUnderReview")}</h3>
        </div>
        <p className="text-xs text-zinc-700 leading-relaxed">{t("orderUnderReviewDesc")}</p>
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
          {t("checkUpdates")}
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
        <h4 className="font-bold text-zinc-950 text-sm">{t("noProvidersTitle")}</h4>
        <p className="text-xs text-zinc-600 leading-relaxed">{t("noProvidersDesc")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-linear-to-b from-indigo-50/50 to-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-indigo-600" />
        <h3 className="font-bold text-zinc-950 text-base">{t("title")}</h3>
      </div>

      <p className="text-xs text-zinc-600 mb-5 leading-relaxed">{t("description")}</p>

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
                  {t("midtrans.name")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {t("midtrans.badge")}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{t("midtrans.desc")}</p>
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
                  {t("stripe.name")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                  {t("stripe.badge")}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">{t("stripe.desc")}</p>
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
            {t("connecting")}
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            {t("payNow", { amount: amountFormatted })}
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
            {t("checkingStatus")}
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
            {t("checkStatus")}
          </>
        )}
      </button>

      <p className="text-[11px] text-zinc-400 text-center mt-3">{t("securityNotice")}</p>
    </div>
  );
}
