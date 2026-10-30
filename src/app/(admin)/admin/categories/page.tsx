import { FolderTree, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createCategoryAction, deleteCategoryAction } from "@/modules/catalog/actions";
import { catalogRepository } from "@/modules/catalog/repository";

export const instant = false;

export default async function AdminCategoriesPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login?callbackUrl=/admin/categories");
  }

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    redirect("/admin/products");
  }

  const categories = await catalogRepository.listCategories(storeId);

  async function handleCreateCategory(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || undefined;
    if (name) {
      await createCategoryAction({ name, description });
    }
  }

  async function handleDeleteCategory(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (id) {
      await deleteCategoryAction(id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Categories</h1>
          <p className="text-sm text-zinc-500">
            Organize products into hierarchical taxonomies for customer navigation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Category Creation Form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Category</h2>
          <form action={handleCreateCategory} className="space-y-4">
            <div>
              <label
                htmlFor="cat-name"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1"
              >
                Category Name
              </label>
              <input
                id="cat-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Specialty Coffee"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="cat-desc"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1"
              >
                Description
              </label>
              <textarea
                id="cat-desc"
                name="description"
                rows={3}
                placeholder="Category summary..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition"
            >
              Save Category
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs md:col-span-2 overflow-hidden">
          <div className="border-b border-zinc-200 bg-zinc-50/75 px-6 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Configured Categories ({categories.length})
            </h3>
          </div>
          {categories.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              <FolderTree className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              No categories created yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50/50"
                >
                  <div>
                    <h4 className="font-medium text-zinc-900">{cat.name}</h4>
                    <p className="text-xs text-zinc-400">slug: /{cat.slug}</p>
                    {cat.description && (
                      <p className="mt-1 text-xs text-zinc-500">{cat.description}</p>
                    )}
                  </div>
                  <form action={handleDeleteCategory}>
                    <input type="hidden" name="id" value={cat.id} />
                    <button
                      type="submit"
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
