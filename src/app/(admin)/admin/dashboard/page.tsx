import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Info,
  Package,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { analyticsService } from "@/modules/analytics/service";
import { hasPermission } from "@/server/guards";
import { RevenueChart } from "./RevenueChart";

interface Props {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/dashboard");
  }

  if (!hasPermission(session.user.role, "analytics:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat laporan analitik dan ringkasan dashboard toko.
      </div>
    );
  }

  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        Toko belum diinisialisasi.
      </div>
    );
  }

  const params = await searchParams;
  const rangePreset = (params.range as "7d" | "30d" | "custom") || "30d";

  const now = new Date();
  let fromDate = new Date();
  let toDate = new Date();

  if (rangePreset === "7d") {
    fromDate.setDate(now.getDate() - 7);
  } else if (rangePreset === "30d") {
    fromDate.setDate(now.getDate() - 30);
  } else if (rangePreset === "custom" && params.from && params.to) {
    fromDate = new Date(params.from);
    toDate = new Date(params.to);
    toDate.setHours(23, 59, 59, 999);
  } else {
    fromDate.setDate(now.getDate() - 30);
  }

  const metrics = await analyticsService.getDashboardMetrics(store.id, {
    from: fromDate,
    to: toDate,
    preset: rangePreset,
  });

  const formattedNetRevenue = formatMoney(createMoney(metrics.netRevenue, "IDR"));
  const formattedGrossRevenue = formatMoney(createMoney(metrics.grossRevenue, "IDR"));
  const formattedRefunds = formatMoney(createMoney(metrics.totalRefunds, "IDR"));
  const formattedAov = formatMoney(createMoney(metrics.aov, "IDR"));

  return (
    <div className="space-y-6">
      {/* Header and Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Dasbor Analitik Toko (Dashboard)
          </h1>
          <p className="text-sm text-zinc-600">
            Ringkasan pendapatan riil, performa pesanan, dan status operasional (Zona Waktu:
            Asia/Jakarta).
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-1 text-xs font-semibold shadow-xs">
          <Link
            href="/admin/dashboard?range=7d"
            className={`px-3 py-1.5 rounded-md transition ${
              rangePreset === "7d" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            7 Hari Terakhir
          </Link>
          <Link
            href="/admin/dashboard?range=30d"
            className={`px-3 py-1.5 rounded-md transition ${
              rangePreset === "30d" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            30 Hari Terakhir
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Pendapatan Bersih (Net)</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{formattedNetRevenue}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Bruto: {formattedGrossRevenue}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Pesanan Terbayar</span>
            <ShoppingBag className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{metrics.ordersCount}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Total transaksi lunas</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Rata-rata Pesanan (AOV)</span>
            <CreditCard className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{formattedAov}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Pendapatan bersih per pesanan</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Refund</span>
            <RotateCcw className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{formattedRefunds}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Pengembalian dana dipotong otomatis</p>
        </div>
      </div>

      {/* Accessible Visual Revenue Chart & Table Fallback */}
      <RevenueChart buckets={metrics.dailyBuckets} />

      {/* 2-Column Grid: Status Distribution & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Package className="h-4 w-4 text-zinc-500" />
            Distribusi Status Pesanan
          </h3>

          <div className="space-y-2 text-xs">
            {metrics.statusDistribution.length === 0 ? (
              <p className="text-zinc-400 italic">Belum ada pesanan pada rentang tanggal ini.</p>
            ) : (
              metrics.statusDistribution.map((st) => (
                <div
                  key={st.status}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0"
                >
                  <span className="font-medium text-zinc-800 uppercase tracking-wider text-[11px]">
                    {st.status.replace("_", " ")}
                  </span>
                  <span className="font-bold text-zinc-950 bg-zinc-100 px-2 py-0.5 rounded-full">
                    {st.count} pesanan
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zinc-500" />
            Produk Terlaris (Top Selling)
          </h3>

          <div className="divide-y divide-zinc-100 text-xs">
            {metrics.topProducts.length === 0 ? (
              <p className="text-zinc-400 italic py-2">Belum ada data penjualan produk.</p>
            ) : (
              metrics.topProducts.map((prod) => (
                <div key={prod.productId} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-zinc-950">{prod.productName}</div>
                    <div className="text-[11px] text-zinc-500">{prod.unitsSold} unit terjual</div>
                  </div>
                  <div className="font-bold text-zinc-950">
                    {formatMoney(createMoney(prod.totalRevenue, "IDR"))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {metrics.lowStockItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold">Peringatan Stok Menipis</h3>
            </div>
            <Link
              href="/admin/inventory?filter=low"
              className="text-xs font-semibold text-amber-900 hover:text-amber-950 flex items-center gap-1"
            >
              Lihat di Inventaris <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 text-xs">
            {metrics.lowStockItems.map((item) => (
              <div
                key={item.variantId}
                className="p-3 bg-white rounded-lg border border-amber-200 space-y-1 shadow-2xs"
              >
                <div className="font-semibold text-zinc-950">{item.productName}</div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {item.sku} • {item.variantTitle}
                </div>
                <div className="text-xs font-bold text-amber-700 pt-1">
                  Sisa Tersedia: {item.availableStock} unit
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Rate Omission Note */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
        <p>
          <strong>Catatan Desain:</strong> Tingkat Konversi (Conversion Rate) sengaja tidak
          disertakan pada fase ini karena pelacakan sesi kunjungan storefront pengunjung (web
          sessions tracking) belum diimplementasikan. Mercato memprioritaskan data transaksi riil
          daripada menampilkan estimasi palsu yang berpotensi menyesatkan merchant.
        </p>
      </div>
    </div>
  );
}
