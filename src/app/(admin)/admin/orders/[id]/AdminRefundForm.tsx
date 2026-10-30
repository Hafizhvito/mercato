"use client";

import { AlertCircle, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import { refundOrderAction } from "@/modules/payments/actions";

interface Props {
  orderId: string;
  orderNumber: string;
  totalAmountMinor: number;
  currency: string;
  isNeedsReview: boolean;
}

export function AdminRefundForm({
  orderId,
  orderNumber,
  totalAmountMinor,
  currency,
  isNeedsReview,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState(
    isNeedsReview
      ? "Manual refund: late payment received after checkout reservation expired and stock exhausted."
      : "Customer request",
  );
  const [restock, setRestock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formattedTotal = formatMoney(createMoney(totalAmountMinor, currency));

  const handleRefund = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await refundOrderAction({
          orderId,
          amountMinor: totalAmountMinor,
          reason,
          restockInventory: restock,
        });
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Refund processing failed");
      }
    });
  };

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Pengembalian Dana Berhasil
        </p>
        <p>Dana telah dikembalikan ke pelanggan dan status pesanan diperbarui.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-zinc-500" />
        Proses Pengembalian Dana (Refund)
      </h3>

      <p className="text-xs text-zinc-600">
        Kirim instruksi pengembalian dana penuh sebesar <strong>{formattedTotal}</strong> untuk
        pesanan <strong className="font-mono">#{orderNumber}</strong> ke gateway pembayaran terkait.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRefund} className="space-y-3">
        <div>
          <label htmlFor="ref-reason" className="block text-xs font-semibold text-zinc-700 mb-1">
            Alasan Pengembalian
          </label>
          <textarea
            id="ref-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          />
          <span>Kembalikan unit item ke stok inventaris (Restock)</span>
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Memproses Refund...
            </>
          ) : (
            `Eksekusi Refund (${formattedTotal})`
          )}
        </button>
      </form>
    </div>
  );
}
