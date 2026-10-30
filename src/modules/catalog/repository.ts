import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type {
  Category,
  Collection,
  NewCategory,
  NewCollection,
  NewProduct,
  NewProductImage,
  NewProductVariant,
  Product,
  ProductImage,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
} from "./schema";

export type {
  Category,
  Collection,
  NewCategory,
  NewCollection,
  NewProduct,
  NewProductImage,
  NewProductVariant,
  Product,
  ProductImage,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
};

export interface ProductDetail extends Product {
  category?: Category | null;
  variants: ProductVariant[];
  images: ProductImage[];
  options: (ProductOption & { values: ProductOptionValue[] })[];
  collections: Collection[];
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  categoryName?: string;
  imageUrl?: string;
  minPrice: number;
  maxPrice: number;
  variantCount: number;
}

export class CatalogRepository {
  async getProductById(id: string, storeId: string): Promise<ProductDetail | null> {
    const [product] = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.id, id),
          eq(schema.products.storeId, storeId),
          isNull(schema.products.deletedAt),
        ),
      )
      .limit(1);

    if (!product) return null;

    let category: Category | null = null;
    if (product.categoryId) {
      const [cat] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, product.categoryId))
        .limit(1);
      category = cat ?? null;
    }

    const variants = await db
      .select()
      .from(schema.productVariants)
      .where(
        and(eq(schema.productVariants.productId, id), isNull(schema.productVariants.deletedAt)),
      )
      .orderBy(asc(schema.productVariants.price));

    const images = await db
      .select()
      .from(schema.productImages)
      .where(eq(schema.productImages.productId, id))
      .orderBy(asc(schema.productImages.position));

    const options = await db
      .select()
      .from(schema.productOptions)
      .where(eq(schema.productOptions.productId, id))
      .orderBy(asc(schema.productOptions.position));

    const optionValues =
      options.length > 0
        ? await db
            .select()
            .from(schema.productOptionValues)
            .where(
              inArray(
                schema.productOptionValues.optionId,
                options.map((o) => o.id),
              ),
            )
            .orderBy(asc(schema.productOptionValues.position))
        : [];

    const optionsWithValues = options.map((opt) => ({
      ...opt,
      values: optionValues.filter((v) => v.optionId === opt.id),
    }));

    const collectionLinks = await db
      .select({
        collection: schema.collections,
      })
      .from(schema.productsToCollections)
      .innerJoin(
        schema.collections,
        eq(schema.collections.id, schema.productsToCollections.collectionId),
      )
      .where(eq(schema.productsToCollections.productId, id));

    return {
      ...product,
      category,
      variants,
      images,
      options: optionsWithValues,
      collections: collectionLinks.map((cl) => cl.collection),
    };
  }

  async getProductBySlug(slug: string, storeId: string): Promise<ProductDetail | null> {
    const [product] = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.slug, slug),
          eq(schema.products.storeId, storeId),
          isNull(schema.products.deletedAt),
        ),
      )
      .limit(1);

    if (!product) return null;
    return this.getProductById(product.id, storeId);
  }

  async listProducts(
    storeId: string,
    params: {
      page?: number;
      limit?: number;
      status?: "draft" | "published" | "archived";
      categoryId?: string;
      search?: string;
    } = {},
  ): Promise<{ products: ProductDetail[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.products.storeId, storeId), isNull(schema.products.deletedAt)];

    if (params.status) {
      conditions.push(eq(schema.products.status, params.status));
    }
    if (params.categoryId) {
      conditions.push(eq(schema.products.categoryId, params.categoryId));
    }
    if (params.search?.trim()) {
      conditions.push(
        sql`(${schema.products.name} ILIKE ${`%${params.search.trim()}%`} OR ${schema.products.slug} ILIKE ${`%${params.search.trim()}%`})`,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.products)
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const productRows = await db
      .select()
      .from(schema.products)
      .where(whereClause)
      .orderBy(desc(schema.products.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch details for each product
    const details = await Promise.all(
      productRows.map(async (p) => {
        const variants = await db
          .select()
          .from(schema.productVariants)
          .where(
            and(
              eq(schema.productVariants.productId, p.id),
              isNull(schema.productVariants.deletedAt),
            ),
          )
          .orderBy(asc(schema.productVariants.price));

        const images = await db
          .select()
          .from(schema.productImages)
          .where(eq(schema.productImages.productId, p.id))
          .orderBy(asc(schema.productImages.position));

        return {
          ...p,
          variants,
          images,
          options: [],
          collections: [],
        };
      }),
    );

    return { products: details, total };
  }

  async createProduct(
    productData: NewProduct,
    variantsData: Omit<NewProductVariant, "productId">[],
    imagesData: Omit<NewProductImage, "productId">[] = [],
    collectionIds: string[] = [],
  ): Promise<ProductDetail> {
    return await db.transaction(async (tx) => {
      const [product] = await tx.insert(schema.products).values(productData).returning();

      if (!product) throw new Error("Failed to insert product record");

      // Insert variants
      const variantsToInsert = variantsData.map((v) => ({
        ...v,
        productId: product.id,
      }));

      const createdVariants =
        variantsToInsert.length > 0
          ? await tx.insert(schema.productVariants).values(variantsToInsert).returning()
          : [];

      // Insert images
      const imagesToInsert = imagesData.map((img, idx) => ({
        ...img,
        productId: product.id,
        position: img.position ?? idx,
      }));

      const createdImages =
        imagesToInsert.length > 0
          ? await tx.insert(schema.productImages).values(imagesToInsert).returning()
          : [];

      // Link collections
      if (collectionIds.length > 0) {
        await tx.insert(schema.productsToCollections).values(
          collectionIds.map((cid) => ({
            productId: product.id,
            collectionId: cid,
          })),
        );
      }

      return {
        ...product,
        variants: createdVariants,
        images: createdImages,
        options: [],
        collections: [],
      };
    });
  }

  async updateProduct(
    id: string,
    storeId: string,
    updateData: Partial<NewProduct>,
  ): Promise<Product | null> {
    const [updated] = await db
      .update(schema.products)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.products.id, id),
          eq(schema.products.storeId, storeId),
          isNull(schema.products.deletedAt),
        ),
      )
      .returning();

    return updated ?? null;
  }

  async softDeleteProduct(id: string, storeId: string): Promise<boolean> {
    const [deleted] = await db
      .update(schema.products)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.products.id, id),
          eq(schema.products.storeId, storeId),
          isNull(schema.products.deletedAt),
        ),
      )
      .returning();

    if (deleted) {
      await db
        .update(schema.productVariants)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.productVariants.productId, id));
      return true;
    }
    return false;
  }

  async listCategories(storeId: string): Promise<Category[]> {
    return db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.storeId, storeId))
      .orderBy(asc(schema.categories.name));
  }

  async getCategoryById(id: string, storeId: string): Promise<Category | null> {
    const [category] = await db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.storeId, storeId)))
      .limit(1);
    return category ?? null;
  }

  async createCategory(data: NewCategory): Promise<Category> {
    const [category] = await db.insert(schema.categories).values(data).returning();
    if (!category) throw new Error("Failed to create category");
    return category;
  }

  async updateCategory(
    id: string,
    storeId: string,
    data: Partial<Pick<NewCategory, "name" | "slug" | "description" | "parentId">>,
  ): Promise<Category | null> {
    const [updated] = await db
      .update(schema.categories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.categories.id, id), eq(schema.categories.storeId, storeId)))
      .returning();
    return updated ?? null;
  }

  async deleteCategory(id: string, storeId: string): Promise<boolean> {
    // Unlink any products currently categorized under this category
    await db
      .update(schema.products)
      .set({ categoryId: null })
      .where(and(eq(schema.products.categoryId, id), eq(schema.products.storeId, storeId)));

    const [deleted] = await db
      .delete(schema.categories)
      .where(and(eq(schema.categories.id, id), eq(schema.categories.storeId, storeId)))
      .returning();
    return !!deleted;
  }

  async listCollections(storeId: string): Promise<Collection[]> {
    return db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.storeId, storeId))
      .orderBy(asc(schema.collections.name));
  }

  async getCollectionBySlug(storeId: string, slug: string): Promise<Collection | null> {
    const [col] = await db
      .select()
      .from(schema.collections)
      .where(and(eq(schema.collections.storeId, storeId), eq(schema.collections.slug, slug)))
      .limit(1);
    return col ?? null;
  }

  async getCollectionById(id: string, storeId: string): Promise<Collection | null> {
    const [col] = await db
      .select()
      .from(schema.collections)
      .where(and(eq(schema.collections.id, id), eq(schema.collections.storeId, storeId)))
      .limit(1);
    return col ?? null;
  }

  async createCollection(data: NewCollection): Promise<Collection> {
    const [col] = await db.insert(schema.collections).values(data).returning();
    if (!col) throw new Error("Failed to create collection");
    return col;
  }

  async updateCollection(
    id: string,
    storeId: string,
    data: Partial<Pick<NewCollection, "name" | "slug" | "description" | "imageUrl">>,
  ): Promise<Collection | null> {
    const [updated] = await db
      .update(schema.collections)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.collections.id, id), eq(schema.collections.storeId, storeId)))
      .returning();
    return updated ?? null;
  }

  async deleteCollection(id: string, storeId: string): Promise<boolean> {
    await db
      .delete(schema.productsToCollections)
      .where(eq(schema.productsToCollections.collectionId, id));

    const [deleted] = await db
      .delete(schema.collections)
      .where(and(eq(schema.collections.id, id), eq(schema.collections.storeId, storeId)))
      .returning();
    return !!deleted;
  }

  async getCollectionProducts(
    storeId: string,
    collectionId: string,
    options: {
      page?: number;
      limit?: number;
      sort?: string;
      categoryId?: string;
    } = {},
  ): Promise<{ products: ProductListItem[]; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 12));
    const offset = (page - 1) * limit;

    const baseConditions = [
      eq(schema.products.storeId, storeId),
      eq(schema.products.status, "published"),
      isNull(schema.products.deletedAt),
      eq(schema.productsToCollections.collectionId, collectionId),
    ];

    if (options.categoryId) {
      baseConditions.push(eq(schema.products.categoryId, options.categoryId));
    }

    const whereClause = and(...baseConditions);

    let orderByClause = desc(schema.products.createdAt);
    if (options.sort === "price-asc") {
      orderByClause = asc(sql`min_price`);
    } else if (options.sort === "price-desc") {
      orderByClause = desc(sql`min_price`);
    } else if (options.sort === "newest") {
      orderByClause = desc(schema.products.createdAt);
    }

    const rows = await db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        slug: schema.products.slug,
        status: schema.products.status,
        createdAt: schema.products.createdAt,
        categoryName: schema.categories.name,
        imageUrl: sql<string | null>`(
          SELECT url FROM ${schema.productImages}
          WHERE product_id = ${schema.products.id}
          ORDER BY position ASC LIMIT 1
        )`,
        minPrice: sql<number>`COALESCE(MIN(${schema.productVariants.price}), 0)`,
        maxPrice: sql<number>`COALESCE(MAX(${schema.productVariants.price}), 0)`,
        variantCount: sql<number>`COUNT(DISTINCT ${schema.productVariants.id})`,
      })
      .from(schema.products)
      .innerJoin(
        schema.productsToCollections,
        eq(schema.products.id, schema.productsToCollections.productId),
      )
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .leftJoin(
        schema.productVariants,
        and(
          eq(schema.products.id, schema.productVariants.productId),
          isNull(schema.productVariants.deletedAt),
        ),
      )
      .where(whereClause)
      .groupBy(schema.products.id, schema.categories.name)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${schema.products.id})` })
      .from(schema.products)
      .innerJoin(
        schema.productsToCollections,
        eq(schema.products.id, schema.productsToCollections.productId),
      )
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);

    const products: ProductListItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: r.createdAt,
      categoryName: r.categoryName ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      minPrice: Number(r.minPrice),
      maxPrice: Number(r.maxPrice),
      variantCount: Number(r.variantCount),
    }));

    return { products, total };
  }
}

export const catalogRepository = new CatalogRepository();
