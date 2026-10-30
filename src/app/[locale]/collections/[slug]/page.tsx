import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/storefront/Header";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createMoney, formatMoney } from "@/lib/money";
import { catalogRepository } from "@/modules/catalog/repository";

export const instant = false;

interface CollectionPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    categoryId?: string;
  }>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) return {};

  const collection = await catalogRepository.getCollectionBySlug(store.id, slug);
  if (!collection) return { title: "Collection Not Found | Mercato" };

  return {
    title: `${collection.name} | Mercato`,
    description: collection.description ?? `Explore items in ${collection.name} on Mercato.`,
    alternates: {
      canonical: `/${locale}/collections/${slug}`,
    },
    openGraph: {
      title: `${collection.name} | Mercato`,
      description: collection.description ?? `Explore items in ${collection.name} on Mercato.`,
      images: collection.imageUrl ? [{ url: collection.imageUrl }] : [],
    },
  };
}

export default async function CollectionDetailPage({ params, searchParams }: CollectionPageProps) {
  const { locale, slug } = await params;
  const resolvedQuery = await searchParams;

  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) notFound();

  const collection = await catalogRepository.getCollectionBySlug(store.id, slug);
  if (!collection) notFound();

  const currentPage = Math.max(1, Number(resolvedQuery.page ?? 1) || 1);
  const currentSort = resolvedQuery.sort ?? "newest";
  const currentCategory = resolvedQuery.categoryId;

  const [{ products, total }, categories] = await Promise.all([
    catalogRepository.getCollectionProducts(store.id, collection.id, {
      page: currentPage,
      limit: 12,
      sort: currentSort,
      categoryId: currentCategory,
    }),
    catalogRepository.listCategories(store.id),
  ]);

  const totalPages = Math.ceil(total / 12) || 1;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />

      <main className="flex-1 pb-16">
        {/* Collection Hero */}
        <div className="relative overflow-hidden bg-zinc-900 py-16 text-white">
          {collection.imageUrl && (
            <div className="absolute inset-0 opacity-25">
              <Image
                src={collection.imageUrl}
                alt={collection.name}
                fill
                priority
                className="object-cover"
              />
            </div>
          )}
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <nav className="mb-4 text-xs font-medium text-zinc-400">
              <Link href={`/${locale}`} className="hover:text-white">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/${locale}/catalog`} className="hover:text-white">
                Catalog
              </Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-200">{collection.name}</span>
            </nav>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="mt-3 max-w-2xl text-base text-zinc-300">{collection.description}</p>
            )}
            <p className="mt-2 text-xs text-zinc-400">
              {total} product{total === 1 ? "" : "s"} available
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          {/* Controls Bar */}
          <div className="mb-8 flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Category:
              </span>
              <Link
                href={`/${locale}/collections/${slug}?sort=${currentSort}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  !currentCategory
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                }`}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/${locale}/collections/${slug}?categoryId=${cat.id}&sort=${currentSort}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    currentCategory === cat.id
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-xs font-medium text-zinc-500">
                Sort by:
              </label>
              <select
                id="sort-select"
                defaultValue={currentSort}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-sm font-medium text-zinc-900">
                No products found in this collection
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Try selecting a different category filter or browse the entire catalog.
              </p>
              <div className="mt-6">
                <Link
                  href={`/${locale}/catalog`}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  View Full Catalog
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p) => {
                const formattedPrice = formatMoney(createMoney(p.minPrice, "IDR"));
                return (
                  <Link
                    key={p.id}
                    href={`/${locale}/products/${p.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      {p.categoryName && (
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                          {p.categoryName}
                        </span>
                      )}
                      <h3 className="mt-1 font-semibold text-zinc-900 group-hover:text-zinc-600 line-clamp-1">
                        {p.name}
                      </h3>
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="font-bold text-zinc-950">
                          {p.minPrice === p.maxPrice ? formattedPrice : `${formattedPrice}+`}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Link
                  key={pageNum}
                  href={`/${locale}/collections/${slug}?page=${pageNum}&sort=${currentSort}${
                    currentCategory ? `&categoryId=${currentCategory}` : ""
                  }`}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold ${
                    pageNum === currentPage
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {pageNum}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
