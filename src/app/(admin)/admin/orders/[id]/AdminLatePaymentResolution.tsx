"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptLatePaymentAction } from "@/modules/orders/actions";

interface Props {
  orderId: string;
}

export function AdminLatePaymentResolution({ orderId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAcceptPayment = () => {
    setError(null);
    startTransition(async () => {
      try {
        await acceptLatePaymentAction({ orderId });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept late payment");
      }
    });
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/70 p-5 shadow-xs space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-950">
            Resolusi Pembayaran Terlambat (Needs Review)
          </h4>
          <p className="text-xs text-amber-900 leading-relaxed">
            Pembayaran telah diterima oleh gateway setelah masa reservasi checkout kedaluwarsa. Anda
            dapat menerima pesanan (sistem akan memvalidasi ketersediaan stok sekarang dan
            menguranginya), atau melakukan pengembalian dana (refund) penuh kepada pelanggan di
            bawah ini.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-white p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={handleAcceptPayment}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Terima Pembayaran & Lanjutkan Pesanan (Re-verify Stock)
        </button>
      </div>
    </div>
  );
}
