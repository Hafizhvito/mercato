import { Layers, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SafeImage } from "@/components/ui/SafeImage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createCollectionAction, deleteCollectionAction } from "@/modules/catalog/actions";
import { catalogRepository } from "@/modules/catalog/repository";

export default async function AdminCollectionsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login?callbackUrl=/admin/collections");
  }

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    redirect("/admin/products");
  }

  const collections = await catalogRepository.listCollections(storeId);

  async function handleCreateCollection(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || undefined;
    const imageUrl = (formData.get("imageUrl") as string) || undefined;
    if (name) {
      await createCollectionAction({ name, description, imageUrl });
    }
  }

  async function handleDeleteCollection(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (id) {
      await deleteCollectionAction(id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Collections</h1>
          <p className="text-sm text-zinc-500">
            Curate thematic product collections for marketing campaigns and storefront showcases.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Collection Form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Collection</h2>
          <form action={handleCreateCollection} className="space-y-4">
            <div>
              <label
                htmlFor="col-name"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1"
              >
                Collection Title
              </label>
              <input
                id="col-name"
                name="name"
                type="text"
                required
                placeholder="e.g. Summer Essentials"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="col-desc"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1"
              >
                Description
              </label>
              <textarea
                id="col-desc"
                name="description"
                rows={3}
                placeholder="Story behind this collection..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="col-image"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1"
              >
                Cover Image URL
              </label>
              <input
                id="col-image"
                name="imageUrl"
                type="url"
                placeholder="https://..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition"
            >
              Save Collection
            </button>
          </form>
        </div>

        {/* Collections List */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs md:col-span-2 overflow-hidden">
          <div className="border-b border-zinc-200 bg-zinc-50/75 px-6 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Active Collections ({collections.length})
            </h3>
          </div>
          {collections.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              <Layers className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              No collections created yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {collections.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50/50"
                >
                  <div className="flex items-center gap-4">
                    {col.imageUrl ? (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200">
                        <SafeImage
                          src={col.imageUrl}
                          fallbackSrc="/images/placeholder.svg"
                          alt={col.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                        <Layers className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-zinc-900">{col.name}</h4>
                      <p className="text-xs text-zinc-400">slug: /{col.slug}</p>
                      {col.description && (
                        <p className="mt-1 text-xs text-zinc-500">{col.description}</p>
                      )}
                    </div>
                  </div>
                  <form action={handleDeleteCollection}>
                    <input type="hidden" name="id" value={col.id} />
                    <button
                      type="submit"
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Delete collection"
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
