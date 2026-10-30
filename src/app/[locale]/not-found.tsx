import Link from "next/link";
import { Header } from "@/components/storefront/Header";

export default function StorefrontNotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          404 Not Found
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Page or Product Not Found
        </h1>
        <p className="mt-3 max-w-md text-sm text-zinc-500">
          The product, collection, or page you are looking for does not exist or may have been
          moved.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/id/catalog"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
          >
            Explore Catalog
          </Link>
          <Link
            href="/id"
            className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
          >
            Back Home
          </Link>
        </div>
      </main>
    </div>
  );
}
