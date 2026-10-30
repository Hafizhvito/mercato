import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ProductForm } from "@/modules/catalog/components/ProductForm";
import { catalogRepository } from "@/modules/catalog/repository";

export default async function AdminNewProductPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login?callbackUrl=/admin/products/new");
  }

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    redirect("/admin/products");
  }

  const [categories, collections] = await Promise.all([
    catalogRepository.listCategories(storeId),
    catalogRepository.listCollections(storeId),
  ]);

  return (
    <div className="max-w-6xl mx-auto py-4">
      <ProductForm categories={categories} collections={collections} />
    </div>
  );
}
