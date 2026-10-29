import { setRequestLocale } from "next-intl/server";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold tracking-tight text-zinc-950">Mercato</span>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
              <a href={`/${locale}`} className="hover:text-zinc-950 transition-colors">
                {locale === "id" ? "Beranda" : "Home"}
              </a>
              <a href={`/${locale}/catalog`} className="hover:text-zinc-950 transition-colors">
                {locale === "id" ? "Katalog" : "Catalog"}
              </a>
              <a href={`/${locale}/collections`} className="hover:text-zinc-950 transition-colors">
                {locale === "id" ? "Koleksi" : "Collections"}
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a
              href={locale === "id" ? "/en" : "/id"}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-700 hover:bg-zinc-50"
            >
              {locale === "id" ? "English" : "Indonesia"}
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800">
              Platform Ready
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl">
              Mercato
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Production-grade e-commerce platform built for scale, speed, and uncompromising
              reliability.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
