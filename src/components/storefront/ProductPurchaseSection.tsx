"use client";

import { AlertCircle, Check, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import type { ProductDetail } from "@/modules/catalog/repository";

interface ProductPurchaseSectionProps {
  product: ProductDetail;
  locale: string;
}

export function ProductPurchaseSection({ product, locale }: ProductPurchaseSectionProps) {
  // Extract unique options from variants or product options
  const hasMultipleVariants = product.variants.length > 1;

  // Selected variant state
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product.variants[0]?.id ?? "");

  const activeVariant = useMemo(() => {
    return product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  }, [product.variants, selectedVariantId]);

  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  const currentPrice = activeVariant?.price ?? 0;
  const compareAtPrice = activeVariant?.compareAtPrice;
  const currentStock = activeVariant?.stock ?? 0;
  const isOutOfStock = currentStock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Price Header */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-extrabold tracking-tight text-zinc-950 font-mono">
          {formatMoney(createMoney(currentPrice, activeVariant?.currency ?? "IDR"))}
        </span>
        {compareAtPrice && compareAtPrice > currentPrice && (
          <span className="text-lg text-zinc-400 line-through font-mono">
            {formatMoney(createMoney(compareAtPrice, activeVariant?.currency ?? "IDR"))}
          </span>
        )}
      </div>

      {/* Stock Status Badge */}
      <div>
        {isOutOfStock ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-3.5 w-3.5" />
            {locale === "id" ? "Stok Habis" : "Out of Stock"}
          </span>
        ) : currentStock <= 5 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
            {locale === "id"
              ? `Tersisa ${currentStock} item lagi!`
              : `Only ${currentStock} items left in stock!`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            {locale === "id" ? "Stok Tersedia" : "In Stock"}
          </span>
        )}
      </div>

      {/* Variant Selector */}
      {hasMultipleVariants && (
        <div className="space-y-3 border-t border-zinc-200 pt-6">
          <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-700">
            {locale === "id" ? "Pilihan Varian:" : "Select Variant:"}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {product.variants.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              const isVarOutOfStock = variant.stock <= 0;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={isVarOutOfStock}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`flex flex-col rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-zinc-950 bg-zinc-950 text-white shadow-xs"
                      : isVarOutOfStock
                        ? "border-zinc-200 bg-zinc-50 opacity-40 cursor-not-allowed text-zinc-400"
                        : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                  }`}
                >
                  <span className="text-xs font-semibold">{variant.title}</span>
                  <span
                    className={`mt-1 text-[11px] font-mono ${
                      isSelected ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {formatMoney(createMoney(variant.price, variant.currency))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity & Add to Cart */}
      <div className="space-y-4 border-t border-zinc-200 pt-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-zinc-200 bg-white">
            <button
              type="button"
              disabled={quantity <= 1 || isOutOfStock}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-950 disabled:opacity-30"
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-semibold text-zinc-900">{quantity}</span>
            <button
              type="button"
              disabled={quantity >= currentStock || isOutOfStock}
              onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
              className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-950 disabled:opacity-30"
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3.5 px-6 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingBag className="h-4 w-4" />
            {isOutOfStock
              ? locale === "id"
                ? "Stok Habis"
                : "Out of Stock"
              : locale === "id"
                ? "Tambah ke Keranjang"
                : "Add to Cart"}
          </button>
        </div>

        {addedNotice && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {locale === "id"
              ? `Berhasil menambahkan ${quantity} item ke keranjang belanja!`
              : `Added ${quantity} item(s) to shopping cart!`}
          </div>
        )}
      </div>

      {/* SKU & Category Metadata */}
      <div className="border-t border-zinc-200 pt-4 space-y-1.5 text-xs text-zinc-500">
        <p>
          <span className="font-semibold text-zinc-700">SKU:</span>{" "}
          <span className="font-mono">{activeVariant?.sku}</span>
        </p>
        {product.category && (
          <p>
            <span className="font-semibold text-zinc-700">
              {locale === "id" ? "Kategori:" : "Category:"}
            </span>{" "}
            {product.category.name}
          </p>
        )}
      </div>
    </div>
  );
}
