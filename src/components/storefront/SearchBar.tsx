"use client";

import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import type { AutocompleteResult } from "@/lib/search";

interface SearchBarProps {
  locale: string;
  initialQuery?: string;
}

export function SearchBar({ locale, initialQuery = "" }: SearchBarProps) {
  const t = useTranslations("common");
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setIsOpen(true);
        }
      } catch {
        // Ignore network errors in autocomplete
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    if (query.trim()) {
      router.push(`/${locale}/catalog?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-full border border-zinc-200 bg-zinc-50/50 py-2 pl-10 pr-10 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden"
        />
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        {isLoading && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="p-2 divide-y divide-zinc-100">
            {results.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/products/${item.slug}`}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 transition"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 relative">
                  {item.primaryImage ? (
                    <SafeImage
                      src={item.primaryImage}
                      fallbackSrc="/images/placeholder.svg"
                      alt={item.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-300">
                      <Search className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                  <p className="text-xs text-zinc-500 font-mono">
                    Rp {item.minPrice.toLocaleString("id-ID")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="border-t border-zinc-100 bg-zinc-50/75 p-2 text-center">
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              {t("viewAllResults", { query })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
