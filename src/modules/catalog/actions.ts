"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { assertRole } from "@/server/guards";
import { catalogRepository } from "./repository";
import { catalogService } from "./service";

const createProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  collectionIds: z.array(z.string().uuid()).optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(2, "SKU is required"),
        title: z.string().min(1, "Title is required"),
        price: z.number().int().min(0, "Price must be a positive integer"),
        compareAtPrice: z.number().int().optional(),
        costPrice: z.number().int().optional(),
        stock: z.number().int().default(0),
        weight: z.number().int().optional(),
        barcode: z.string().optional(),
      }),
    )
    .min(1, "At least one variant is required"),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        altText: z.string().optional(),
        position: z.number().int().default(0),
      }),
    )
    .optional(),
});

const updateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export async function createProductAction(input: z.infer<typeof createProductSchema>) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Ensure role is admin or owner
  assertRole(session.user, "admin");

  // Determine merchant active store
  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    throw new Error("No store associated with account");
  }

  const validated = createProductSchema.parse(input);

  const product = await catalogService.createProductWithVariants(storeId, validated);

  // Write audit log entry
  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    details: JSON.stringify({ name: product.name, slug: product.slug }),
  });

  revalidatePath("/admin/products");
  return { success: true, product };
}

export async function updateProductAction(input: z.infer<typeof updateProductSchema>) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    throw new Error("Unauthorized");
  }

  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    throw new Error("No store associated with account");
  }

  const validated = updateProductSchema.parse(input);
  const { id, ...data } = validated;

  await catalogService.updateProduct(id, storeId, data);

  // Write audit log
  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "product.updated",
    entityType: "product",
    entityId: id,
    details: JSON.stringify(data),
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  return { success: true };
}

export async function deleteProductAction(id: string) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    throw new Error("Unauthorized");
  }

  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    throw new Error("No store associated with account");
  }

  const success = await catalogService.deleteProduct(id, storeId);

  if (success) {
    await db.insert(schema.auditLogs).values({
      storeId,
      userId: session.user.id,
      action: "product.deleted",
      entityType: "product",
      entityId: id,
      details: "Product soft deleted",
    });
  }

  revalidatePath("/admin/products");
  return { success };
}

export async function createCategoryAction(input: {
  name: string;
  description?: string;
  parentId?: string;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    throw new Error("Unauthorized");
  }

  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    throw new Error("No store associated with account");
  }

  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");

  const category = await catalogRepository.createCategory({
    storeId,
    name: input.name,
    slug,
    description: input.description ?? null,
    parentId: input.parentId ?? null,
  });

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "category.created",
    entityType: "category",
    entityId: category.id,
    details: JSON.stringify({ name: category.name }),
  });

  revalidatePath("/admin/categories");
  return { success: true, category };
}

export async function createCollectionAction(input: {
  name: string;
  description?: string;
  imageUrl?: string;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    throw new Error("Unauthorized");
  }

  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }

  if (!storeId) {
    throw new Error("No store associated with account");
  }

  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");

  const col = await catalogRepository.createCollection({
    storeId,
    name: input.name,
    slug,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
  });

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "collection.created",
    entityType: "collection",
    entityId: col.id,
    details: JSON.stringify({ name: col.name }),
  });

  revalidatePath("/admin/collections");
  return { success: true, collection: col };
}

export async function updateCategoryAction(input: {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) throw new Error("Unauthorized");
  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }
  if (!storeId) throw new Error("No store associated with account");

  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");

  const updated = await catalogRepository.updateCategory(input.id, storeId, {
    name: input.name,
    slug,
    description: input.description ?? null,
    parentId: input.parentId ?? null,
  });

  if (!updated) throw new Error("Category not found");

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "category.updated",
    entityType: "category",
    entityId: input.id,
    details: JSON.stringify({ name: input.name }),
  });

  revalidatePath("/admin/categories");
  return { success: true, category: updated };
}

export async function deleteCategoryAction(id: string) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) throw new Error("Unauthorized");
  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }
  if (!storeId) throw new Error("No store associated with account");

  const success = await catalogRepository.deleteCategory(id, storeId);
  if (!success) throw new Error("Category not found or could not be deleted");

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "category.deleted",
    entityType: "category",
    entityId: id,
    details: JSON.stringify({ id }),
  });

  revalidatePath("/admin/categories");
  return { success: true };
}

export async function updateCollectionAction(input: {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) throw new Error("Unauthorized");
  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }
  if (!storeId) throw new Error("No store associated with account");

  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");

  const updated = await catalogRepository.updateCollection(input.id, storeId, {
    name: input.name,
    slug,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
  });

  if (!updated) throw new Error("Collection not found");

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "collection.updated",
    entityType: "collection",
    entityId: input.id,
    details: JSON.stringify({ name: input.name }),
  });

  revalidatePath("/admin/collections");
  return { success: true, collection: updated };
}

export async function deleteCollectionAction(id: string) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) throw new Error("Unauthorized");
  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }
  if (!storeId) throw new Error("No store associated with account");

  const success = await catalogRepository.deleteCollection(id, storeId);
  if (!success) throw new Error("Collection not found or could not be deleted");

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "collection.deleted",
    entityType: "collection",
    entityId: id,
    details: JSON.stringify({ id }),
  });

  revalidatePath("/admin/collections");
  return { success: true };
}

export async function bulkUpdateProductStatusAction(input: {
  productIds: string[];
  status: "draft" | "published" | "archived";
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) throw new Error("Unauthorized");
  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }
  if (!storeId) throw new Error("No store associated with account");

  if (!input.productIds.length) return { success: true, count: 0 };

  const updated = await db
    .update(schema.products)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        inArray(schema.products.id, input.productIds),
        eq(schema.products.storeId, storeId),
        isNull(schema.products.deletedAt),
      ),
    )
    .returning();

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "product.bulk_status_update",
    entityType: "product",
    entityId: input.productIds[0] ?? "",
    details: JSON.stringify({ status: input.status, count: updated.length }),
  });

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  return { success: true, count: updated.length };
}

export async function bulkDeleteProductsAction(input: { productIds: string[] }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) throw new Error("Unauthorized");
  assertRole(session.user, "admin");

  let storeId = (session.user as { storeId?: string | null }).storeId;
  if (!storeId) {
    const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
    storeId = store?.id;
  }
  if (!storeId) throw new Error("No store associated with account");

  if (!input.productIds.length) return { success: true, count: 0 };

  const updated = await db
    .update(schema.products)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        inArray(schema.products.id, input.productIds),
        eq(schema.products.storeId, storeId),
        isNull(schema.products.deletedAt),
      ),
    )
    .returning();

  await db.insert(schema.auditLogs).values({
    storeId,
    userId: session.user.id,
    action: "product.bulk_delete",
    entityType: "product",
    entityId: input.productIds[0] ?? "",
    details: JSON.stringify({ count: updated.length }),
  });

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  return { success: true, count: updated.length };
}
