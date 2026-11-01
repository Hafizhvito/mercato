"use client";

import { CheckCircle2, Loader2, Save, Store as StoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Store } from "@/lib/db/schema";
import { updateStoreSettingsAction } from "@/modules/settings/actions";

interface Props {
  store: Store;
}

export function StoreInfoForm({ store }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(store.name);
  const [contactEmail, setContactEmail] = useState(store.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(store.contactPhone || "");
  const [address, setAddress] = useState(store.address || "");
  const [lowStockThreshold, setLowStockThreshold] = useState(store.lowStockThreshold ?? 5);
  const [taxRatePercent, setTaxRatePercent] = useState(store.taxRatePercent ?? 0);
  const [taxInclusive, setTaxInclusive] = useState(store.taxInclusive ?? false);

  // Flat rate zones
  const initialRates = (store.shippingFlatRates as Record<string, number>) || {
    Jabodetabek: 10000,
    "Jawa Non-Jabodetabek": 18000,
    "Luar Jawa": 35000,
  };
  const [shippingRates, setShippingRates] = useState<Record<string, number>>(initialRates);

  const handleRateChange = (zone: string, val: number) => {
    setShippingRates((prev) => ({ ...prev, [zone]: Math.max(0, val) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await updateStoreSettingsAction({
          name,
          contactEmail,
          contactPhone,
          address,
          lowStockThreshold: Number(lowStockThreshold),
          taxRatePercent: Number(taxRatePercent),
          taxInclusive,
          shippingFlatRates: shippingRates,
        });
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memperbarui pengaturan toko");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Pengaturan toko berhasil diperbarui.</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Profil Informasi Toko */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <StoreIcon className="h-4 w-4 text-zinc-500" />
          Informasi Utama Toko
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="store-name" className="block font-semibold text-zinc-700 mb-1">
              Nama Toko
            </label>
            <input
              id="store-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="store-contact-email" className="block font-semibold text-zinc-700 mb-1">
              Email Kontak Operasional
            </label>
            <input
              id="store-contact-email"
              type="email"
              placeholder="support@mercato.local"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="store-contact-phone" className="block font-semibold text-zinc-700 mb-1">
              Nomor Telepon Toko
            </label>
            <input
              id="store-contact-phone"
              type="tel"
              placeholder="08123456789"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label
              htmlFor="store-low-stock-threshold"
              className="block font-semibold text-zinc-700 mb-1"
            >
              Batas Peringatan Stok Menipis (Threshold)
            </label>
            <input
              id="store-low-stock-threshold"
              type="number"
              min="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Varian dengan stok &le; angka ini akan ditandai di dashboard dan inventaris.
            </p>
          </div>
        </div>

        <div className="text-xs">
          <label htmlFor="store-address" className="block font-semibold text-zinc-700 mb-1">
            Alamat Gudang / Pengirim Toko
          </label>
          <textarea
            id="store-address"
            rows={2}
            placeholder="Alamat asal pengiriman paket pesanan..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Pengaturan Pajak & Tarif Pengiriman Flat Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pajak */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-950">Pengaturan Pajak (PPN)</h3>
          <p className="text-xs text-zinc-500">
            Konfigurasi tarif pajak pertambahan nilai yang dibebankan pada pesanan pelanggan.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="store-tax-rate" className="block font-semibold text-zinc-700 mb-1">
                Tarif Pajak (%)
              </label>
              <input
                id="store-tax-rate"
                type="number"
                min="0"
                max="100"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
              <p className="text-[11px] text-zinc-400 mt-1">Default 0% jika toko belum PKP.</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={taxInclusive}
                onChange={(e) => setTaxInclusive(e.target.checked)}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span className="text-zinc-800 font-medium">
                Harga produk sudah termasuk pajak (Tax Inclusive)
              </span>
            </label>
          </div>
        </div>

        {/* Zona Flat Rate Ongkir */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-950">Zona Tarif Ongkir Flat Rate</h3>
          <p className="text-xs text-zinc-500">
            Penyesuaian tarif flat pengiriman per wilayah tujuan di Indonesia.
          </p>

          <div className="space-y-3 text-xs">
            {Object.entries(shippingRates).map(([zone, rate]) => (
              <div key={zone} className="flex items-center justify-between gap-4">
                <span className="font-semibold text-zinc-800">{zone}</span>
                <div className="flex items-center gap-1.5 w-40">
                  <span className="text-zinc-500">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={rate}
                    onChange={(e) => handleRateChange(zone, Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 p-1.5 text-zinc-900 font-mono text-right focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-zinc-900 font-semibold text-xs text-white hover:bg-zinc-800 disabled:opacity-50 shadow-xs transition"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Pengaturan Toko
        </button>
      </div>
    </form>
  );
}
