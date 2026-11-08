"use client";

import { useRouter } from "next/navigation";

interface CatalogSortSelectProps {
  sort: string;
  searchQuery?: string;
  selectedCategorySlug?: string;
  selectedCollectionSlug?: string;
  locale: string;
}

export function CatalogSortSelect({
  sort,
  searchQuery,
  selectedCategorySlug,
  selectedCollectionSlug,
  locale,
}: CatalogSortSelectProps) {
  const router = useRouter();

  function handleChange(newSort: string) {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategorySlug) params.set("category", selectedCategorySlug);
    if (selectedCollectionSlug) params.set("collection", selectedCollectionSlug);
    if (newSort) params.set("sort", newSort);
    router.push(`/${locale}/catalog?${params.toString()}`);
  }

  return (
    <form method="GET">
      {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
      {selectedCategorySlug && <input type="hidden" name="category" value={selectedCategorySlug} />}
      {selectedCollectionSlug && (
        <input type="hidden" name="collection" value={selectedCollectionSlug} />
      )}
      <select
        id="sort-select"
        name="sort"
        defaultValue={sort}
        onChange={(e) => handleChange(e.target.value)}
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
  );
}
