"use client";

import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelUnpaidOrderAction } from "@/modules/orders/actions";

interface Props {
  orderId: string;
  orderNumber: string;
}

export function AdminCancelUnpaidButton({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState(
    "Dibatalkan atas permintaan pelanggan atau batas waktu pembayaran berakhir",
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await cancelUnpaidOrderAction({ orderId, reason });
        setIsOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel unpaid order");
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-bold text-zinc-950">Batalkan Pesanan Belum Bayar</h3>
      </div>

      <p className="text-xs text-zinc-600">
        Membatalkan pesanan yang belum dibayar akan secara otomatis melepaskan (release) semua
        reservasi stok inventaris terkait kembali ke etalase toko.
      </p>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-lg border border-red-200 bg-red-50 py-2 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
        >
          Batalkan Pesanan #{orderNumber}
        </button>
      ) : (
        <form onSubmit={handleCancel} className="space-y-3 pt-2">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="cancel-reason"
              className="block text-[11px] font-semibold text-zinc-700 mb-1"
            >
              Alasan Pembatalan
            </label>
            <input
              id="cancel-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsOpen(false)}
              className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || !reason.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Konfirmasi Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
