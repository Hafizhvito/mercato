import { Package, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import { unstable_cacheTag as cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { StorefrontHeader } from "@/components/storefront/Header";
import { ProductPurchaseSection } from "@/components/storefront/ProductPurchaseSection";
import { SafeImage } from "@/components/ui/SafeImage";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogRepository } from "@/modules/catalog/repository";

interface ProductPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) return { title: "Product Not Found | Mercato" };

  const product = await catalogRepository.getProductBySlug(slug, store.id);
  if (!product) return { title: "Product Not Found | Mercato" };

  const title = product.seoTitle || `${product.name} | Mercato`;
  const description =
    product.seoDescription || product.description?.slice(0, 160) || "Buy online at Mercato";

  const primaryImage = product.images[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: primaryImage ? [{ url: primaryImage }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: primaryImage ? [primaryImage] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) {
    notFound();
  }

  const product = await catalogRepository.getProductBySlug(slug, store.id);
  if (product?.status !== "published") {
    notFound();
  }

  // Tag cache for on-demand revalidation in Next.js 16
  try {
    cacheTag(`product-${product.id}`);
  } catch {
    // Outside request cache boundary
  }

  const minPrice =
    product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : 0;

  // JSON-LD Structured Data (schema.org/Product)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.seoDescription,
    image: product.images.map((img) => img.url),
    sku: product.variants[0]?.sku,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.variants[0]?.currency || "IDR",
      lowPrice: minPrice,
      highPrice: Math.max(...product.variants.map((v) => v.price)),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Inject Structured Data */}
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <StorefrontHeader locale={locale} />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
          <Link href={`/${locale}`} className="hover:text-zinc-900">
            {locale === "id" ? "Beranda" : "Home"}
          </Link>
          <span>/</span>
          <Link href={`/${locale}/catalog`} className="hover:text-zinc-900">
            {locale === "id" ? "Katalog" : "Catalog"}
          </Link>
          {product.category && (
            <>
              <span>/</span>
              <Link
                href={`/${locale}/catalog?category=${product.category.slug}`}
                className="hover:text-zinc-900"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-zinc-900 font-medium truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left Column: Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 relative flex items-center justify-center">
              {product.images[0]?.url ? (
                <SafeImage
                  src={product.images[0].url}
                  fallbackSrc="/images/placeholder.svg"
                  alt={product.images[0].altText || product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <Package className="h-16 w-16 text-zinc-300" />
              )}
            </div>

            {/* Thumbnail Strip */}
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.map((img, idx) => (
                  <div
                    key={img.id ?? `${img.url}-${idx}`}
                    className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 relative"
                  >
                    <SafeImage
                      src={img.url}
                      fallbackSrc="/images/placeholder.svg"
                      alt={img.altText || product.name}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Details & Purchasing */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
                {product.name}
              </h1>
              {product.category && (
                <p className="mt-1 text-sm font-medium text-zinc-500">{product.category.name}</p>
              )}
            </div>

            {/* Dynamic Purchase & Variant Section */}
            <ProductPurchaseSection product={product} locale={locale} />

            {/* Description */}
            {product.description && (
              <div className="border-t border-zinc-200 pt-6 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
                  {locale === "id" ? "Deskripsi Produk" : "Product Description"}
                </h3>
                <div className="prose prose-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                  {product.description}
                </div>
              </div>
            )}

            {/* Trust Badges */}
            <div className="border-t border-zinc-200 pt-6 grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50">
                <ShieldCheck className="h-5 w-5 text-zinc-700" />
                <span className="text-xs font-semibold text-zinc-800">
                  {locale === "id" ? "100% Asli" : "100% Genuine"}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {locale === "id" ? "Garansi orisinal" : "Guaranteed"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50">
                <Truck className="h-5 w-5 text-zinc-700" />
                <span className="text-xs font-semibold text-zinc-800">
                  {locale === "id" ? "Kirim Cepat" : "Fast Delivery"}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {locale === "id" ? "Seluruh Nusantara" : "Nationwide"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50">
                <RotateCcw className="h-5 w-5 text-zinc-700" />
                <span className="text-xs font-semibold text-zinc-800">
                  {locale === "id" ? "7 Hari Retur" : "7 Days Return"}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {locale === "id" ? "Syarat berlaku" : "Hassle-free"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
