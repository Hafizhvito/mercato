"use client";

import { AlertCircle, Loader2, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDiscountAction, updateDiscountAction } from "@/modules/discounts/actions";
import type { Discount } from "@/modules/discounts/schema";

interface Props {
  discount?: Discount | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DiscountModal({ discount, isOpen, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState(discount?.code || "");
  const [type, setType] = useState<"percentage" | "fixed" | "free_shipping">(
    (discount?.type as "percentage" | "fixed" | "free_shipping") || "percentage",
  );
  const [value, setValue] = useState<number>(discount?.value ?? 10);
  const [minSpend, setMinSpend] = useState<number>(discount?.minSpend ?? 0);
  const [maxDiscount, setMaxDiscount] = useState<number | string>(discount?.maxDiscount ?? "");
  const [usageLimit, setUsageLimit] = useState<number | string>(discount?.usageLimit ?? "");
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | string>(
    discount?.perCustomerLimit ?? "",
  );
  const [startsAt, setStartsAt] = useState<string>(
    discount?.startsAt
      ? new Date(discount.startsAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    discount?.expiresAt ? new Date(discount.expiresAt).toISOString().slice(0, 16) : "",
  );
  const [isActive, setIsActive] = useState<boolean>(discount?.isActive ?? true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          code,
          type,
          value: Number(value),
          minSpend: Number(minSpend) || 0,
          maxDiscount: maxDiscount ? Number(maxDiscount) : null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
          startsAt,
          expiresAt: expiresAt || null,
          isActive,
        };

        if (discount?.id) {
          await updateDiscountAction({ ...payload, id: discount.id });
        } else {
          await createDiscountAction(payload);
        }

        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyimpan kupon diskon");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-zinc-600" />
            <h3 className="text-base font-bold text-zinc-950">
              {discount ? `Edit Kupon #${discount.code}` : "Buat Kupon Diskon Baru"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="discount-code" className="block font-semibold text-zinc-700 mb-1">
              Kode Kupon (Alfanumerik)
            </label>
            <input
              id="discount-code"
              type="text"
              required
              placeholder="Contoh: HEMAT10, MERDEKA50"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-zinc-200 p-2 font-mono font-bold text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="discount-type" className="block font-semibold text-zinc-700 mb-1">
                Jenis Diskon
              </label>
              <select
                id="discount-type"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "percentage" | "fixed" | "free_shipping")
                }
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
              >
                <option value="percentage">Persentase (%)</option>
                <option value="fixed">Nominal Tetap (Rp)</option>
                <option value="free_shipping">Gratis Ongkir</option>
              </select>
            </div>

            {type !== "free_shipping" && (
              <div>
                <label htmlFor="discount-value" className="block font-semibold text-zinc-700 mb-1">
                  Nilai {type === "percentage" ? "(%)" : "(Rp Minor)"}
                </label>
                <input
                  id="discount-value"
                  type="number"
                  min="1"
                  max={type === "percentage" ? 100 : undefined}
                  required
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="discount-min-spend"
                className="block font-semibold text-zinc-700 mb-1"
              >
                Minimal Belanja (Rp Minor)
              </label>
              <input
                id="discount-min-spend"
                type="number"
                min="0"
                value={minSpend}
                onChange={(e) => setMinSpend(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>

            {type === "percentage" && (
              <div>
                <label
                  htmlFor="discount-max-discount"
                  className="block font-semibold text-zinc-700 mb-1"
                >
                  Batas Diskon Maksimal (Rp Cap)
                </label>
                <input
                  id="discount-max-discount"
                  type="number"
                  min="0"
                  placeholder="Kosongkan jika tak terbatas"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="discount-usage-limit"
                className="block font-semibold text-zinc-700 mb-1"
              >
                Batas Kuota Total
              </label>
              <input
                id="discount-usage-limit"
                type="number"
                min="1"
                placeholder="Tak Terbatas"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="discount-per-customer-limit"
                className="block font-semibold text-zinc-700 mb-1"
              >
                Batas per Pelanggan
              </label>
              <input
                id="discount-per-customer-limit"
                type="number"
                min="1"
                placeholder="1 (Default)"
                value={perCustomerLimit}
                onChange={(e) => setPerCustomerLimit(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="discount-starts-at"
                className="block font-semibold text-zinc-700 mb-1"
              >
                Berlaku Mulai
              </label>
              <input
                id="discount-starts-at"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="discount-expires-at"
                className="block font-semibold text-zinc-700 mb-1"
              >
                Kedaluwarsa (Opsional)
              </label>
              <input
                id="discount-expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span className="font-semibold text-zinc-800">Kupon Aktif dan Dapat Digunakan</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {discount ? "Perbarui Kupon" : "Buat Kupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
