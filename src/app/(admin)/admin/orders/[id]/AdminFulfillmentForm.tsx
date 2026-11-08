"use client";

import { CheckCircle, Loader2, PackageCheck, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fulfillOrderAction } from "@/modules/orders/actions";

interface Props {
  orderId: string;
  currentStatus: string;
  existingCarrier?: string | null;
  existingTrackingNumber?: string | null;
}

export function AdminFulfillmentForm({
  orderId,
  currentStatus,
  existingCarrier,
  existingTrackingNumber,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState(existingCarrier || "JNE");
  const [trackingNumber, setTrackingNumber] = useState(existingTrackingNumber || "");
  const [error, setError] = useState<string | null>(null);

  const handleAdvanceStatus = (targetStatus: "processing" | "shipped" | "delivered") => {
    setError(null);
    startTransition(async () => {
      try {
        await fulfillOrderAction({
          orderId,
          status: targetStatus,
          carrier: targetStatus === "shipped" ? carrier : undefined,
          trackingNumber: targetStatus === "shipped" ? trackingNumber : undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fulfillment update failed");
      }
    });
  };

  if (currentStatus === "delivered") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          Pesanan Selesai Terkirim (Delivered)
        </div>
        <p className="text-zinc-600">
          Pesanan ini telah sukses diserahkan ke pelanggan melalui kurir{" "}
          {existingCarrier || "ekspedisi"}.
        </p>
      </div>
    );
  }

  if (currentStatus === "cancelled") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
        Pesanan dibatalkan. Tidak ada tindakan pengiriman yang dapat diproses.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-zinc-500" />
        <h3 className="text-sm font-bold text-zinc-950">Alur Pemenuhan & Pengiriman</h3>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {currentStatus === "paid" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-600">
            Pesanan telah dibayar dan siap disiapkan di gudang (Packing / Processing).
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAdvanceStatus("processing")}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PackageCheck className="h-3.5 w-3.5" />
            )}
            Mulai Kemas (Tandai Processing)
          </button>
        </div>
      )}

      {currentStatus === "processing" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdvanceStatus("shipped");
          }}
          className="space-y-3"
        >
          <p className="text-xs text-zinc-600">
            Masukkan ekspedisi dan nomor resi pelacakan untuk menandai pesanan sebagai dikirim
            (Shipped). Email notifikasi resi akan otomatis dikirim ke pelanggan.
          </p>

          <div>
            <label
              htmlFor="fulfillment-carrier"
              className="block text-[11px] font-semibold text-zinc-700 mb-1"
            >
              Kurir Ekspedisi
            </label>
            <select
              id="fulfillment-carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
            >
              <option value="JNE">JNE</option>
              <option value="SiCepat">SiCepat</option>
              <option value="J&T Express">J&T Express</option>
              <option value="POS Indonesia">POS Indonesia</option>
              <option value="Anteraja">Anteraja</option>
              <option value="Ninja Xpress">Ninja Xpress</option>
              <option value="Lion Parcel">Lion Parcel</option>
              <option value="GoSend">GoSend (Instant/Same Day)</option>
              <option value="GrabExpress">GrabExpress</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="fulfillment-tracking"
              className="block text-[11px] font-semibold text-zinc-700 mb-1"
            >
              Nomor Resi Pengiriman
            </label>
            <input
              id="fulfillment-tracking"
              type="text"
              required
              placeholder="Contoh: SOCAG0012345678"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2 text-xs font-mono text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !trackingNumber.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Truck className="h-3.5 w-3.5" />
            )}
            Tandai Dikirim (Shipped)
          </button>
        </form>
      )}

      {currentStatus === "shipped" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs space-y-1">
            <div className="font-semibold text-blue-950">Sedang Dalam Pengiriman</div>
            <div className="text-blue-800">
              Kurir: <strong>{existingCarrier || carrier}</strong>
            </div>
            <div className="text-blue-800 font-mono">
              Resi: <strong>{existingTrackingNumber || trackingNumber}</strong>
            </div>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAdvanceStatus("delivered")}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Konfirmasi Telah Tiba (Delivered)
          </button>
        </div>
      )}
    </div>
  );
}
