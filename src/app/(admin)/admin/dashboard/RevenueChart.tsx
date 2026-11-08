"use client";

import { BarChart3, Table as TableIcon } from "lucide-react";
import { useState } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import type { DailyRevenueBucket } from "@/modules/analytics/service";

interface Props {
  buckets: DailyRevenueBucket[];
}

export function RevenueChart({ buckets }: Props) {
  const [showTable, setShowTable] = useState(false);

  if (buckets.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs text-center text-zinc-400 py-12">
        <BarChart3 className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
        Belum ada data pendapatan pada rentang tanggal yang dipilih.
      </div>
    );
  }

  const maxRevenue = Math.max(...buckets.map((b) => b.netRevenue), 1);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">Tren Pendapatan Bersih Harian</h3>
          <p className="text-xs text-zinc-500">
            Dihitung berdasarkan zona waktu Asia/Jakarta (WIB) dikurangi refund.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
        >
          <TableIcon className="h-3.5 w-3.5" />
          {showTable ? "Tampilkan Grafik" : "Tampilkan Tabel Data"}
        </button>
      </div>

      {!showTable ? (
        /* Visual Accessible SVG Bar Chart */
        <div className="space-y-2 pt-2">
          <div
            className="flex items-end gap-2 h-48 w-full border-b border-zinc-200 pb-2 overflow-x-auto"
            role="img"
            aria-label="Grafik batang tren pendapatan harian"
          >
            {buckets.map((b) => {
              const heightPercent = Math.max(8, Math.round((b.netRevenue / maxRevenue) * 100));
              const formattedAmt = formatMoney(createMoney(b.netRevenue, "IDR"));
              const dateLabel = b.date.slice(5); // MM-DD

              return (
                <div
                  key={b.date}
                  className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group relative"
                >
                  {/* Tooltip on hover/focus */}
                  <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap pointer-events-none">
                    <span className="font-bold">{formattedAmt}</span>
                    <span className="text-zinc-400">
                      {b.ordersCount} pesanan • {b.date}
                    </span>
                  </div>

                  <div
                    title={`${b.date}: ${formattedAmt} (${b.ordersCount} pesanan)`}
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-zinc-900 rounded-t-sm group-hover:bg-blue-600 transition-colors"
                  />

                  <span className="text-[10px] text-zinc-400 font-mono mt-1">{dateLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Accessible Fallback Data Table */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
            <thead className="bg-zinc-50 font-semibold text-zinc-600 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Tanggal (WIB)
                </th>
                <th scope="col" className="px-4 py-2.5 text-center">
                  Jumlah Pesanan
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Pendapatan Bersih
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {buckets.map((b) => (
                <tr key={b.date} className="hover:bg-zinc-50">
                  <td className="px-4 py-2 font-mono text-zinc-700">{b.date}</td>
                  <td className="px-4 py-2 text-center text-zinc-950 font-bold">{b.ordersCount}</td>
                  <td className="px-4 py-2 text-right text-zinc-950 font-bold font-mono">
                    {formatMoney(createMoney(b.netRevenue, "IDR"))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
