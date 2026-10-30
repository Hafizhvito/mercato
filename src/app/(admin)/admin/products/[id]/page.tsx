import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ProductForm } from "@/modules/catalog/components/ProductForm";
import { catalogRepository } from "@/modules/catalog/repository";

export const dynamic = "force-dynamic";

interface ProductEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminEditProductPage({ params }: ProductEditPageProps) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    redirect("/admin/products");
  }

  const [product, categories, collections] = await Promise.all([
    catalogRepository.getProductById(id, storeId),
    catalogRepository.listCategories(storeId),
    catalogRepository.listCollections(storeId),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto py-4">
      <ProductForm initialProduct={product} categories={categories} collections={collections} />
    </div>
  );
}
