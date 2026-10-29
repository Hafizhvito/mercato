import { ArrowUpDown, Package, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { StorefrontHeader } from "@/components/storefront/Header";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { searchService } from "@/lib/search";
import { catalogRepository } from "@/modules/catalog/repository";

export const instant = false;

interface CatalogPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    collection?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: "relevance" | "price_asc" | "price_desc" | "newest";
    page?: string;
  }>;
}

export default async function StorefrontCatalogPage({ params, searchParams }: CatalogPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const resolvedParams = await searchParams;
  const searchQuery = resolvedParams.q ?? "";
  const selectedCategorySlug = resolvedParams.category;
  const selectedCollectionSlug = resolvedParams.collection;
  const sort = resolvedParams.sort ?? "newest";
  const currentPage = Number(resolvedParams.page ?? 1) || 1;
  const minPrice = resolvedParams.minPrice ? Number(resolvedParams.minPrice) : undefined;
  const maxPrice = resolvedParams.maxPrice ? Number(resolvedParams.maxPrice) : undefined;

  // Retrieve primary store
  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) {
    notFound();
  }

  // Fetch categories and collections for filter sidebar
  const [categories, collections] = await Promise.all([
    catalogRepository.listCategories(store.id),
    catalogRepository.listCollections(store.id),
  ]);

  // Resolve category/collection ID if slug provided
  let categoryId: string | undefined;
  if (selectedCategorySlug) {
    const matched = categories.find((c) => c.slug === selectedCategorySlug);
    categoryId = matched?.id;
  }

  let collectionId: string | undefined;
  if (selectedCollectionSlug) {
    const matched = collections.find((c) => c.slug === selectedCollectionSlug);
    collectionId = matched?.id;
  }

  const limit = 16;
  const offset = (currentPage - 1) * limit;

  // Query search service
  const { items: products, total } = await searchService.searchProducts({
    storeId: store.id,
    query: searchQuery,
    categoryId,
    collectionId,
    status: "published",
    minPrice,
    maxPrice,
    sort,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/50">
      <StorefrontHeader locale={locale} />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb / Title */}
        <div className="flex flex-col gap-2 border-b border-zinc-200 pb-6 mb-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href={`/${locale}`} className="hover:text-zinc-900">
              {locale === "id" ? "Beranda" : "Home"}
            </Link>
            <span>/</span>
            <span className="text-zinc-900 font-medium">
              {locale === "id" ? "Katalog Produk" : "Product Catalog"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
                {searchQuery
                  ? `${locale === "id" ? 'Hasil pencarian untuk "' : 'Search results for "'}${searchQuery}"`
                  : locale === "id"
                    ? "Semua Produk"
                    : "All Products"}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {total} {locale === "id" ? "produk ditemukan" : "products found"}
              </p>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-select"
                className="text-xs font-medium text-zinc-500 flex items-center gap-1"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {locale === "id" ? "Urutkan:" : "Sort by:"}
              </label>
              <form method="GET">
                {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
                {selectedCategorySlug && (
                  <input type="hidden" name="category" value={selectedCategorySlug} />
                )}
                {selectedCollectionSlug && (
                  <input type="hidden" name="collection" value={selectedCollectionSlug} />
                )}
                <select
                  id="sort-select"
                  name="sort"
                  defaultValue={sort}
                  onChange={(e) => e.target.form?.submit()}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                >
                  <option value="newest">{locale === "id" ? "Terbaru" : "Newest"}</option>
                  <option value="price_asc">
                    {locale === "id" ? "Harga: Rendah ke Tinggi" : "Price: Low to High"}
                  </option>
                  <option value="price_desc">
                    {locale === "id" ? "Harga: Tinggi ke Rendah" : "Price: High to Low"}
                  </option>
                  {searchQuery && (
                    <option value="relevance">{locale === "id" ? "Relevansi" : "Relevance"}</option>
                  )}
                </select>
              </form>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-6">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <SlidersHorizontal className="h-4 w-4 text-zinc-700" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  {locale === "id" ? "Filter Produk" : "Filters"}
                </h3>
              </div>

              {/* Categories */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  {locale === "id" ? "Kategori" : "Categories"}
                </h4>
                <div className="space-y-2">
                  <Link
                    href={`/${locale}/catalog${searchQuery ? `?q=${searchQuery}` : ""}`}
                    className={`block text-xs transition ${
                      !selectedCategorySlug
                        ? "font-semibold text-zinc-950"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {locale === "id" ? "Semua Kategori" : "All Categories"}
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/${locale}/catalog?category=${cat.slug}${
                        searchQuery ? `&q=${searchQuery}` : ""
                      }`}
                      className={`block text-xs transition ${
                        selectedCategorySlug === cat.slug
                          ? "font-semibold text-zinc-950"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Collections */}
              {collections.length > 0 && (
                <div className="border-t border-zinc-100 pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                    {locale === "id" ? "Koleksi" : "Collections"}
                  </h4>
                  <div className="space-y-2">
                    {collections.map((col) => (
                      <Link
                        key={col.id}
                        href={`/${locale}/catalog?collection=${col.slug}${
                          searchQuery ? `&q=${searchQuery}` : ""
                        }`}
                        className={`block text-xs transition ${
                          selectedCollectionSlug === col.slug
                            ? "font-semibold text-zinc-950"
                            : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        {col.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="lg:col-span-3 space-y-8">
            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-16 text-center">
                <Package className="mx-auto h-12 w-12 text-zinc-300" />
                <h3 className="mt-4 text-base font-semibold text-zinc-900">
                  {locale === "id" ? "Tidak ada produk ditemukan" : "No products found"}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {locale === "id"
                    ? "Coba ubah kata kunci pencarian atau sesuaikan pilihan filter Anda."
                    : "Try adjusting your search terms or clearing current filter selections."}
                </p>
                <div className="mt-6">
                  <Link
                    href={`/${locale}/catalog`}
                    className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                  >
                    {locale === "id" ? "Reset Filter" : "Reset Filters"}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/${locale}/products/${product.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs hover:shadow-md transition"
                  >
                    {/* Image Container */}
                    <div className="aspect-square w-full overflow-hidden bg-zinc-100 flex items-center justify-center relative">
                      {product.primaryImage ? (
                        <Image
                          src={product.primaryImage}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Package className="h-10 w-10 text-zinc-300" />
                      )}
                    </div>

                    {/* Card Content */}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 pt-6">
                <span className="text-xs text-zinc-500">
                  {locale === "id"
                    ? `Halaman ${currentPage} dari ${totalPages}`
                    : `Page ${currentPage} of ${totalPages}`}
                </span>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <Link
                      href={`/${locale}/catalog?page=${currentPage - 1}${
                        searchQuery ? `&q=${searchQuery}` : ""
                      }${selectedCategorySlug ? `&category=${selectedCategorySlug}` : ""}${
                        selectedCollectionSlug ? `&collection=${selectedCollectionSlug}` : ""
                      }&sort=${sort}`}
                      className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      {locale === "id" ? "Sebelumnya" : "Previous"}
                    </Link>
                  )}
                  {currentPage < totalPages && (
                    <Link
                      href={`/${locale}/catalog?page=${currentPage + 1}${
                        searchQuery ? `&q=${searchQuery}` : ""
                      }${selectedCategorySlug ? `&category=${selectedCategorySlug}` : ""}${
                        selectedCollectionSlug ? `&collection=${selectedCollectionSlug}` : ""
                      }&sort=${sort}`}
                      className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      {locale === "id" ? "Selanjutnya" : "Next"}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
