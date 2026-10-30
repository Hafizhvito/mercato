import { AlertCircle, Package, Plus, Search } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogRepository } from "@/modules/catalog/repository";
import { ProductTableWithBulkActions } from "./ProductTableWithBulkActions";

export const dynamic = "force-dynamic";

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: "draft" | "published" | "archived";
    categoryId?: string;
  }>;
}

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login?callbackUrl=/admin/products");
  }

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-zinc-400" />
        <h2 className="mt-4 text-lg font-semibold text-zinc-900">No Store Configured</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Please seed or configure a store before managing products.
        </p>
      </div>
    );
  }

  const resolvedParams = await searchParams;
  const currentPage = Number(resolvedParams.page ?? 1) || 1;
  const searchQuery = resolvedParams.search ?? "";
  const statusFilter = resolvedParams.status;
  const categoryFilter = resolvedParams.categoryId;

  const [{ products, total }, _categories] = await Promise.all([
    catalogRepository.listProducts(storeId, {
      page: currentPage,
      limit: 15,
      search: searchQuery,
      status: statusFilter,
      categoryId: categoryFilter,
    }),
    catalogRepository.listCategories(storeId),
  ]);

  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Products</h1>
          <p className="text-sm text-zinc-500">
            Manage your store inventory, variants, prices, and catalog status.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <form method="GET" className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="Search products by title or SKU..."
            className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-hidden"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-xs font-medium">
            <Link
              href="/admin/products"
              className={`rounded-md px-3 py-1.5 transition ${
                !statusFilter
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              All
            </Link>
            <Link
              href="/admin/products?status=published"
              className={`rounded-md px-3 py-1.5 transition ${
                statusFilter === "published"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Published
            </Link>
            <Link
              href="/admin/products?status=draft"
              className={`rounded-md px-3 py-1.5 transition ${
                statusFilter === "draft"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Draft
            </Link>
            <Link
              href="/admin/products?status=archived"
              className={`rounded-md px-3 py-1.5 transition ${
                statusFilter === "archived"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Archived
            </Link>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
        {products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-zinc-300" />
            <h3 className="mt-4 text-sm font-semibold text-zinc-900">No products found</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Get started by creating your first product or adjusting search filters.
            </p>
            <div className="mt-6">
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </Link>
            </div>
          </div>
        ) : (
          <ProductTableWithBulkActions products={products} />
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-6 py-3 text-sm">
            <span className="text-xs text-zinc-500">
              Showing page {currentPage} of {totalPages} ({total} total products)
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/admin/products?page=${currentPage - 1}${
                    statusFilter ? `&status=${statusFilter}` : ""
                  }${searchQuery ? `&search=${searchQuery}` : ""}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Previous
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={`/admin/products?page=${currentPage + 1}${
                    statusFilter ? `&status=${statusFilter}` : ""
                  }${searchQuery ? `&search=${searchQuery}` : ""}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
