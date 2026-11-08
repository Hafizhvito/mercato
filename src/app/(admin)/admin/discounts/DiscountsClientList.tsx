"use client";

import { CheckCircle2, Clock, Edit2, Plus, Power, Tag, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import { deleteDiscountAction, toggleDiscountAction } from "@/modules/discounts/actions";
import type { Discount } from "@/modules/discounts/schema";
import { DiscountModal } from "./DiscountModal";

interface Props {
  discounts: Discount[];
  canManage: boolean;
}

export function DiscountsClientList({ discounts, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);

  const handleOpenCreate = () => {
    setSelectedDiscount(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Discount) => {
    setSelectedDiscount(d);
    setModalOpen(true);
  };

  const handleToggle = (id: string) => {
    startTransition(async () => {
      try {
        await toggleDiscountAction(id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Gagal mengubah status diskon");
      }
    });
  };

  const handleDelete = (id: string, code: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kupon #${code}?`)) return;

    startTransition(async () => {
      try {
        await deleteDiscountAction(id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Gagal menghapus diskon");
      }
    });
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Diskon & Promosi</h1>
          <p className="text-sm text-zinc-600">
            Kelola kode kupon, voucher persentase, potongan nominal, dan promo gratis ongkir.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 py-2 px-3 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Buat Kupon Diskon
          </button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-3.5">Kode Kupon</th>
                <th className="px-6 py-3.5">Tipe & Nilai</th>
                <th className="px-6 py-3.5">Min. Belanja</th>
                <th className="px-6 py-3.5 text-center">Penggunaan</th>
                <th className="px-6 py-3.5">Masa Berlaku</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {discounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                    <Tag className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                    Belum ada kupon diskon yang dibuat.
                  </td>
                </tr>
              ) : (
                discounts.map((d) => {
                  const isExpired = d.expiresAt && new Date(d.expiresAt) < now;
                  const isExhausted = d.usageLimit && d.usageCount >= d.usageLimit;

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktif
                    </span>
                  );

                  if (!d.isActive) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-zinc-400 font-medium text-xs">
                        <XCircle className="h-3.5 w-3.5" />
                        Nonaktif
                      </span>
                    );
                  } else if (isExpired) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        Kedaluwarsa
                      </span>
                    );
                  } else if (isExhausted) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-red-700 font-semibold text-xs">
                        <XCircle className="h-3.5 w-3.5" />
                        Kuota Habis
                      </span>
                    );
                  }

                  let typeDisplay = `${d.value}%`;
                  if (d.type === "fixed") {
                    typeDisplay = formatMoney(createMoney(d.value, "IDR"));
                  } else if (d.type === "free_shipping") {
                    typeDisplay = "Gratis Ongkir";
                  }

                  return (
                    <tr key={d.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-zinc-950 bg-zinc-100 px-2 py-1 rounded border border-zinc-200 text-xs">
                          {d.code}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <div className="font-bold text-zinc-950">{typeDisplay}</div>
                        {d.maxDiscount && (
                          <div className="text-[11px] text-zinc-500">
                            Maks: {formatMoney(createMoney(d.maxDiscount, "IDR"))}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-zinc-700">
                        {d.minSpend > 0
                          ? formatMoney(createMoney(d.minSpend, "IDR"))
                          : "Tanpa Minimal"}
                      </td>

                      <td className="px-6 py-4 text-center text-xs font-mono">
                        <span className="font-bold text-zinc-950">{d.usageCount}</span>
                        <span className="text-zinc-400">
                          {" "}
                          / {d.usageLimit ? d.usageLimit : "∞"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-zinc-500">
                        <div>
                          Mulai:{" "}
                          {new Date(d.startsAt).toLocaleDateString("id-ID", {
                            dateStyle: "short",
                          })}
                        </div>
                        {d.expiresAt && (
                          <div className={isExpired ? "text-amber-700 font-semibold" : ""}>
                            Hingga:{" "}
                            {new Date(d.expiresAt).toLocaleDateString("id-ID", {
                              dateStyle: "short",
                            })}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">{statusBadge}</td>

                      <td className="px-6 py-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggle(d.id)}
                              title={d.isActive ? "Nonaktifkan Kupon" : "Aktifkan Kupon"}
                              className={`p-1.5 rounded-lg border transition ${
                                d.isActive
                                  ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  : "border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(d)}
                              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDelete(d.id, d.code)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DiscountModal
        discount={selectedDiscount}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
