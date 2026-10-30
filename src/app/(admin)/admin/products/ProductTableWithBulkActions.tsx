"use client";

import { Check, Package, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { createMoney, formatMoney } from "@/lib/money";
import { bulkDeleteProductsAction, bulkUpdateProductStatusAction } from "@/modules/catalog/actions";
import type { ProductDetail } from "@/modules/catalog/repository";

interface Props {
  products: ProductDetail[];
}

export function ProductTableWithBulkActions({ products }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSelected = products.length > 0 && selectedIds.length === products.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleStatusChange(status: "draft" | "published" | "archived") {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      try {
        await bulkUpdateProductStatusAction({ productIds: selectedIds, status });
        setFeedback(`Updated ${selectedIds.length} products to ${status}`);
        setSelectedIds([]);
        setTimeout(() => setFeedback(null), 3000);
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Bulk update failed");
      }
    });
  }

  function handleDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} product(s)?`)) {
      return;
    }
    startTransition(async () => {
      try {
        await bulkDeleteProductsAction({ productIds: selectedIds });
        setFeedback(`Deleted ${selectedIds.length} products`);
        setSelectedIds([]);
        setTimeout(() => setFeedback(null), 3000);
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Bulk delete failed");
      }
    });
  }

  return (
    <div className="relative">
      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-white shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-zinc-950">
              {selectedIds.length}
            </span>
            <span>products selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("published")}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 disabled:opacity-50"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("draft")}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 disabled:opacity-50"
            >
              Draft
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("archived")}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 disabled:opacity-50"
            >
              Archive
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-zinc-400 hover:text-white ml-2"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/75 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all products"
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
              </th>
              <th scope="col" className="px-6 py-3">
                Product
              </th>
              <th scope="col" className="px-6 py-3">
                Status
              </th>
              <th scope="col" className="px-6 py-3">
                Inventory
              </th>
              <th scope="col" className="px-6 py-3">
                Price
              </th>
              <th scope="col" className="px-6 py-3">
                Variants
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {products.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              const minPrice =
                product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : 0;
              const maxPrice =
                product.variants.length > 0 ? Math.max(...product.variants.map((v) => v.price)) : 0;
              const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);
              const primaryImg = product.images[0]?.url;

              return (
                <tr
                  key={product.id}
                  className={`transition ${isSelected ? "bg-zinc-50" : "hover:bg-zinc-50/50"}`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(product.id)}
                      aria-label={`Select ${product.name}`}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center relative">
                        {primaryImg ? (
                          <SafeImage
                            src={primaryImg}
                            fallbackSrc="/images/placeholder.svg"
                            alt={product.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-zinc-400" />
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-zinc-400">/{product.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        product.status === "published"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : product.status === "draft"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-medium ${
                        totalStock > 0 ? "text-zinc-900" : "text-rose-600"
                      }`}
                    >
                      {totalStock > 0 ? `${totalStock} in stock` : "Out of stock"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-900 font-medium">
                    {minPrice === maxPrice
                      ? formatMoney(createMoney(minPrice, "IDR"))
                      : `${formatMoney(createMoney(minPrice, "IDR"))} - ${formatMoney(
                          createMoney(maxPrice, "IDR"),
                        )}`}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-600"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
