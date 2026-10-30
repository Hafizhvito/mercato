import { ArrowRight, Package } from "lucide-react";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { StorefrontHeader } from "@/components/storefront/Header";
import { SafeImage } from "@/components/ui/SafeImage";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { type SearchProductResult, searchService } from "@/lib/search";
import { type Collection, catalogRepository } from "@/modules/catalog/repository";

export const instant = false;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [store] = await db.select().from(schema.stores).limit(1);

  let featuredProducts: SearchProductResult[] = [];
  let collections: Collection[] = [];

  if (store) {
    const [{ items }, cols] = await Promise.all([
      searchService.searchProducts({
        storeId: store.id,
        status: "published",
        limit: 8,
        sort: "newest",
      }),
      catalogRepository.listCollections(store.id),
    ]);
    featuredProducts = items;
    collections = cols;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50/40">
      <StorefrontHeader locale={locale} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
                {locale === "id" ? "Koleksi Terbaru 2026" : "New 2026 Collections"}
              </span>
              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                {locale === "id"
                  ? "Belanja Produk Terbaik dengan Pengalaman Modern"
                  : "Discover Premium Quality Products with Ease"}
              </h1>
              <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed">
                {locale === "id"
                  ? "Platform belanja online modern dengan jaminan keaslian produk, pembayaran lokal cepat, dan pengiriman terpercaya ke seluruh Indonesia."
                  : "Modern online commerce engineered for speed, authenticity, and seamless shopping experience with instant local and international payments."}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={`/${locale}/catalog`}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
                >
                  {locale === "id" ? "Jelajahi Katalog" : "Explore Catalog"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition"
                >
                  {locale === "id" ? "Masuk Admin" : "Merchant Portal"}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Collections Strip */}
        {collections.length > 0 && (
          <section className="border-b border-zinc-200 bg-white py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold tracking-tight text-zinc-950 mb-6">
                {locale === "id" ? "Koleksi Pilihan" : "Featured Collections"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {collections.map((col) => (
                  <Link
                    key={col.id}
                    href={`/${locale}/catalog?collection=${col.slug}`}
                    className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-6 flex flex-col justify-end min-h-48 hover:shadow-md transition"
                  >
                    {col.imageUrl && (
                      <SafeImage
                        src={col.imageUrl}
                        fallbackSrc="/images/placeholder.svg"
                        alt={col.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-zinc-950/80 via-zinc-950/30 to-transparent" />
                    <div className="relative z-10 text-white">
                      <h3 className="text-lg font-bold">{col.name}</h3>
                      {col.description && (
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-1">{col.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Products Grid */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                {locale === "id" ? "Produk Terbaru" : "New Arrivals"}
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                {locale === "id"
                  ? "Pilihan produk terpopuler dan terlaris minggu ini."
                  : "Trending items and newly released essentials."}
              </p>
            </div>
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:text-zinc-600"
            >
              {locale === "id" ? "Lihat Semua" : "View All"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500">
              <Package className="mx-auto h-10 w-10 text-zinc-300 mb-2" />
              <p className="text-sm">
                {locale === "id"
                  ? "Belum ada produk yang dipublikasikan. Jalankan seed catalog untuk mengisi data demo."
                  : "No published products yet. Run catalog seed script to load demo products."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/${locale}/products/${product.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs hover:shadow-md transition"
                >
                  <div className="aspect-square w-full overflow-hidden bg-zinc-100 flex items-center justify-center relative">
                    {product.primaryImage ? (
                      <SafeImage
                        src={product.primaryImage}
                        fallbackSrc="/images/placeholder.svg"
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 transition line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="mt-auto pt-3">
                      <p className="text-sm font-bold text-zinc-950">
                        {formatMoney(createMoney(product.minPrice, product.currency))}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} Mercato. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href={`/${locale}/catalog`} className="hover:text-zinc-900 transition">
              Catalog
            </Link>
            <Link href="/admin/dashboard" className="hover:text-zinc-900 transition">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
