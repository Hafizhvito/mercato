import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { SearchBar } from "./SearchBar";

interface StorefrontHeaderProps {
  locale?: string;
}

export function StorefrontHeader({ locale = "id" }: StorefrontHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-8">
          <Link href={`/${locale}`} className="text-xl font-bold tracking-tight text-zinc-950">
            Mercato
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <Link href={`/${locale}`} className="hover:text-zinc-950 transition-colors">
              {locale === "id" ? "Beranda" : "Home"}
            </Link>
            <Link href={`/${locale}/catalog`} className="hover:text-zinc-950 transition-colors">
              {locale === "id" ? "Katalog" : "Catalog"}
            </Link>
            <Link
              href={`/${locale}/catalog?collection=featured`}
              className="hover:text-zinc-950 transition-colors"
            >
              {locale === "id" ? "Unggulan" : "Featured"}
            </Link>
          </nav>
        </div>

        {/* Global Autocomplete Search */}
        <div className="flex-1 max-w-md hidden sm:block">
          <SearchBar locale={locale} />
        </div>

        {/* Action Controls & Locale Switcher */}
        <div className="flex items-center gap-4 text-sm">
          <Link
            href={`/${locale}/cart`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{locale === "id" ? "Keranjang" : "Cart"}</span>
          </Link>
          <Link
            href={locale === "id" ? "/en" : "/id"}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-700 hover:bg-zinc-50"
          >
            {locale === "id" ? "English" : "Indonesia"}
          </Link>
          <Link
            href="/admin/dashboard"
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 border-l border-zinc-200 pl-4"
          >
            Merchant Admin
          </Link>
        </div>
      </div>
    </header>
  );
}

export const Header = StorefrontHeader;
