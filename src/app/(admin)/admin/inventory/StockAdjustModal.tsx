"use client";

import { AlertCircle, History, Loader2, Minus, Plus, Sliders, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustStockAction, getStockAdjustmentHistoryAction } from "@/modules/inventory/actions";
import type { StockAdjustment } from "@/modules/inventory/schema";

export interface VariantInventoryItem {
  variantId: string;
  sku: string;
  variantTitle: string;
  productName: string;
  physicalStock: number;
  activeReservations: number;
  availableStock: number;
  imageUrl?: string | null;
}

interface Props {
  variant: VariantInventoryItem;
  canAdjust: boolean;
}

export function StockAdjustModal({ variant, canAdjust }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // History drawer/tab
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<StockAdjustment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const delta = mode === "add" ? amount : -amount;
  const projectedStock = variant.physicalStock + delta;

  const handleOpen = () => {
    setIsOpen(true);
    setError(null);
    setAmount(1);
    setReason("");
    setShowHistory(false);
  };

  const handleLoadHistory = async () => {
    setShowHistory(true);
    setIsLoadingHistory(true);
    try {
      const records = await getStockAdjustmentHistoryAction(variant.variantId);
      setHistoryList(records);
    } catch {
      // history load failed
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Alasan penyesuaian stok wajib diisi.");
      return;
    }

    if (projectedStock < 0) {
      setError("Stok fisik tidak dapat dikurangi di bawah 0.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await adjustStockAction({
          variantId: variant.variantId,
          delta,
          reason: reason.trim(),
        });
        setIsOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyesuaikan stok");
      }
    });
  };

  if (!canAdjust) {
    return (
      <button
        type="button"
        disabled
        className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 text-zinc-400 cursor-not-allowed"
      >
        Lihat Saja
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 shadow-xs transition"
      >
        <Sliders className="h-3.5 w-3.5 text-zinc-500" />
        Sesuaikan
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Penyesuaian Stok Inventaris</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {variant.productName} —{" "}
                  <span className="font-semibold text-zinc-700">{variant.variantTitle}</span> (
                  <span className="font-mono">{variant.sku}</span>)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Stock Snapshot */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
              <div>
                <div className="text-[11px] text-zinc-500">Stok Fisik</div>
                <div className="text-lg font-bold text-zinc-950">{variant.physicalStock}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Reservasi Aktif</div>
                <div className="text-lg font-bold text-amber-600">{variant.activeReservations}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">Stok Tersedia</div>
                <div className="text-lg font-bold text-emerald-600">{variant.availableStock}</div>
              </div>
            </div>

            {/* Mode selection: Add vs Subtract */}
            <div className="flex rounded-lg bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setMode("add")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
                  mode === "add"
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                Tambah Stok (Restock)
              </button>
              <button
                type="button"
                onClick={() => setMode("subtract")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition ${
                  mode === "subtract"
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Minus className="h-3.5 w-3.5 text-red-600" />
                Kurangi Stok (Koreksi/Rusak)
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`adjust-amount-${variant.variantId}`}
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Jumlah ({mode === "add" ? "+" : "-"})
                  </label>
                  <input
                    id={`adjust-amount-${variant.variantId}`}
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-lg border border-zinc-200 p-2 text-xs font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-zinc-700 mb-1">
                    Stok Fisik Baru
                  </span>
                  <div
                    className={`p-2 rounded-lg border text-xs font-bold ${
                      projectedStock < 0
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-900"
                    }`}
                  >
                    {projectedStock} unit
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`adjust-reason-${variant.variantId}`}
                  className="block text-xs font-semibold text-zinc-700 mb-1"
                >
                  Alasan Penyesuaian (Wajib Diisi)
                </label>
                <input
                  id={`adjust-reason-${variant.variantId}`}
                  type="text"
                  required
                  placeholder="Contoh: Restock faktur #INV-982, opname gudang, barang rusak"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleLoadHistory}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  <History className="h-3.5 w-3.5" />
                  Lihat Riwayat
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3.5 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || projectedStock < 0 || !reason.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Perubahan"
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Riwayat Penyesuaian Drawer */}
            {showHistory && (
              <div className="pt-3 border-t border-zinc-200 space-y-2">
                <div className="text-xs font-bold text-zinc-950 flex items-center justify-between">
                  <span>Riwayat Penyesuaian Varian Ini</span>
                  {isLoadingHistory && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-zinc-100 text-xs">
                  {historyList.length === 0 && !isLoadingHistory && (
                    <p className="text-zinc-400 italic py-2">Belum ada riwayat penyesuaian stok.</p>
                  )}
                  {historyList.map((hist) => (
                    <div key={hist.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span
                          className={`font-semibold ${
                            hist.delta > 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {hist.delta > 0 ? `+${hist.delta}` : hist.delta}
                        </span>{" "}
                        <span className="text-zinc-500">
                          ({hist.previousStock} → {hist.newStock})
                        </span>
                        <p className="text-zinc-600 text-[11px]">{hist.reason}</p>
                      </div>
                      <div className="text-right text-[10px] text-zinc-400">
                        <div>{hist.userName}</div>
                        <div>{new Date(hist.createdAt).toLocaleDateString("id-ID")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
