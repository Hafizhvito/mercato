import { eq, sql } from "drizzle-orm";
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  PackageOpen,
  Search,
  XCircle,
} from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hasPermission } from "@/server/guards";
import { StockAdjustModal, type VariantInventoryItem } from "./StockAdjustModal";

interface Props {
  searchParams: Promise<{
    q?: string;
    filter?: string;
  }>;
}

export default async function AdminInventoryPage({ searchParams }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/inventory");
  }

  if (!hasPermission(session.user.role, "inventory:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat manajemen inventaris toko.
      </div>
    );
  }

  const canAdjust = hasPermission(session.user.role, "inventory:adjust");
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const filter = params.filter || "all";

  // Get primary store low stock threshold
  const [store] = await db
    .select({
      id: schema.stores.id,
      lowStockThreshold: schema.stores.lowStockThreshold,
    })
    .from(schema.stores)
    .limit(1);

  const lowStockThreshold = store?.lowStockThreshold ?? 5;
  const now = new Date();

  // Query variants with active reservations and product info
  const rawVariants = await db
    .select({
      variantId: schema.productVariants.id,
      sku: schema.productVariants.sku,
      variantTitle: schema.productVariants.title,
      physicalStock: schema.productVariants.stock,
      productId: schema.products.id,
      productName: schema.products.name,
      imageUrl: sql<string | null>`
        (SELECT pi.url
         FROM ${schema.productImages} pi
         WHERE pi.product_id = ${schema.products.id}
         ORDER BY pi.position ASC
         LIMIT 1)
      `,
      activeReservations: sql<number>`
        COALESCE(
          (SELECT SUM(sr.quantity)
           FROM ${schema.stockReservations} sr
           WHERE sr.variant_id = ${schema.productVariants.id}
             AND sr.status = 'active'
             AND sr.reserved_until >= ${now}),
          0
        )::int
      `,
    })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
    .orderBy(schema.products.name, schema.productVariants.title);

  // Compute available stock and filter in memory
  let items: (VariantInventoryItem & { isLowStock: boolean; isOutOfStock: boolean })[] =
    rawVariants.map((v) => {
      const available = Math.max(0, v.physicalStock - v.activeReservations);
      const isOutOfStock = available <= 0;
      const isLowStock = !isOutOfStock && available <= lowStockThreshold;

      return {
        variantId: v.variantId,
        sku: v.sku,
        variantTitle: v.variantTitle,
        productName: v.productName,
        physicalStock: v.physicalStock,
        activeReservations: v.activeReservations,
        availableStock: available,
        imageUrl: v.imageUrl,
        isLowStock,
        isOutOfStock,
      };
    });

  // Calculate high-level summary counters
  const totalVariants = items.length;
  const totalPhysicalUnits = items.reduce((acc, i) => acc + i.physicalStock, 0);
  const outOfStockCount = items.filter((i) => i.isOutOfStock).length;
  const lowStockCount = items.filter((i) => i.isLowStock).length;

  // Filter by search query
  if (q) {
    const queryLower = q.toLowerCase();
    items = items.filter(
      (item) =>
        item.sku.toLowerCase().includes(queryLower) ||
        item.productName.toLowerCase().includes(queryLower) ||
        item.variantTitle.toLowerCase().includes(queryLower),
    );
  }

  // Filter by status tab
  if (filter === "low") {
    items = items.filter((item) => item.isLowStock);
  } else if (filter === "out") {
    items = items.filter((item) => item.isOutOfStock);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Inventaris (Inventory)</h1>
        <p className="text-sm text-zinc-600">
          Pantau stok fisik gudang, alokasi reservasi checkout real-time, dan lakukan penyesuaian
          stok.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total SKU / Varian</span>
            <Boxes className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{totalVariants}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Varian aktif terdaftar di etalase</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Unit Fisik</span>
            <Archive className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{totalPhysicalUnits}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Total seluruh item di gudang</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold uppercase">Stok Menipis (Low Stock)</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-950">{lowStockCount}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Tersedia &le; {lowStockThreshold} unit</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-red-700 mb-2">
            <span className="text-xs font-semibold uppercase">Stok Habis (Out of Stock)</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-950">{outOfStockCount}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Perlu restock segera</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-xs text-xs font-medium">
          <Link
            href={{ pathname: "/admin/inventory", query: q ? { q } : {} }}
            className={`px-3 py-1.5 rounded-md transition ${
              filter === "all"
                ? "bg-zinc-900 text-white font-semibold"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            Semua ({totalVariants})
          </Link>
          <Link
            href={{
              pathname: "/admin/inventory",
              query: { ...(q ? { q } : {}), filter: "low" },
            }}
            className={`px-3 py-1.5 rounded-md transition ${
              filter === "low"
                ? "bg-amber-600 text-white font-semibold"
                : "text-amber-800 hover:text-amber-950"
            }`}
          >
            Menipis ({lowStockCount})
          </Link>
          <Link
            href={{
              pathname: "/admin/inventory",
              query: { ...(q ? { q } : {}), filter: "out" },
            }}
            className={`px-3 py-1.5 rounded-md transition ${
              filter === "out"
                ? "bg-red-600 text-white font-semibold"
                : "text-red-700 hover:text-red-950"
            }`}
          >
            Habis ({outOfStockCount})
          </Link>
        </div>

        {/* Search input */}
        <form method="GET" className="relative flex-1 max-w-sm">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Cari produk, SKU, atau varian..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
          />
        </form>
      </div>

      {/* Inventory Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-3.5">Produk & Varian</th>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5 text-center">Stok Fisik</th>
                <th className="px-6 py-3.5 text-center">Reservasi Aktif</th>
                <th className="px-6 py-3.5 text-center">Stok Tersedia</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                    <PackageOpen className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                    Tidak ada item varian inventaris yang sesuai.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.variantId} className="hover:bg-zinc-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 relative">
                            <Image
                              src={item.imageUrl}
                              alt={item.productName}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-bold">
                            IMG
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-zinc-950 text-xs">
                            {item.productName}
                          </div>
                          <div className="text-zinc-500 text-[11px]">{item.variantTitle}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-xs text-zinc-700">{item.sku}</td>

                    <td className="px-6 py-4 text-center font-bold text-zinc-950 text-xs">
                      {item.physicalStock}
                    </td>

                    <td className="px-6 py-4 text-center text-xs">
                      {item.activeReservations > 0 ? (
                        <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {item.activeReservations} di-hold
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center text-xs">
                      <span
                        className={`font-bold px-2.5 py-1 rounded-md ${
                          item.isOutOfStock
                            ? "bg-red-100 text-red-800"
                            : item.isLowStock
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {item.availableStock}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {item.isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          Habis
                        </span>
                      ) : item.isLowStock ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Menipis (&le;{lowStockThreshold})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Tersedia
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <StockAdjustModal variant={item} canAdjust={canAdjust} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
