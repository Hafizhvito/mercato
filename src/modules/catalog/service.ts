import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { type CatalogRepository, catalogRepository, type ProductDetail } from "./repository";
import type { NewProduct, NewProductImage, NewProductVariant } from "./schema";

export interface OptionInput {
  name: string;
  values: string[];
}

export interface GeneratedVariant {
  title: string;
  sku: string;
  price: number;
  stock: number;
  selectedOptions: { name: string; value: string }[];
}

export class CatalogService {
  constructor(private repo: CatalogRepository = catalogRepository) {}

  /**
   * Slugify string and verify uniqueness within store boundary
   */
  async generateUniqueSlug(
    storeId: string,
    name: string,
    currentProductId?: string,
  ): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let candidateSlug = baseSlug || "product";
    let counter = 1;

    while (true) {
      const conditions = [
        eq(schema.products.storeId, storeId),
        eq(schema.products.slug, candidateSlug),
        isNull(schema.products.deletedAt),
      ];

      if (currentProductId) {
        conditions.push(sql`${schema.products.id} != ${currentProductId}`);
      }

      const [existing] = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(and(...conditions))
        .limit(1);

      if (!existing) {
        return candidateSlug;
      }

      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Compute Cartesian product of option values to generate default variants
   */
  generateVariantsFromOptions(
    options: OptionInput[],
    baseSku: string,
    defaultPrice: number,
  ): GeneratedVariant[] {
    const validOptions = options.filter((opt) => opt.name.trim() && opt.values.length > 0);

    if (validOptions.length === 0) {
      return [
        {
          title: "Default Variant",
          sku: `${baseSku.toUpperCase()}-DEF`,
          price: defaultPrice,
          stock: 0,
          selectedOptions: [],
        },
      ];
    }

    // Cartesian product helper
    const cartesian = (
      arrays: { name: string; value: string }[][],
    ): { name: string; value: string }[][] => {
      return arrays.reduce<{ name: string; value: string }[][]>(
        (acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])),
        [[]],
      );
    };

    const optionChoices = validOptions.map((opt) =>
      opt.values.map((val) => ({
        name: opt.name.trim(),
        value: val.trim(),
      })),
    );

    const combinations = cartesian(optionChoices);
    const seenSkus = new Set<string>();

    return combinations.map((combo, idx) => {
      const title = combo.map((c) => c.value).join(" / ");
      const rawSkuSuffix = combo
        .map((c) =>
          c.value
            .trim()
            .split(/\s+/)
            .map((w) => w.slice(0, 3).toUpperCase())
            .join(""),
        )
        .join("-");

      let finalSku = `${baseSku.toUpperCase()}-${rawSkuSuffix}`;
      if (seenSkus.has(finalSku)) {
        finalSku = `${finalSku}-${idx + 1}`;
      }
      seenSkus.add(finalSku);

      return {
        title,
        sku: finalSku,
        price: defaultPrice,
        stock: 0,
        selectedOptions: combo,
      };
    });
  }

  async getProduct(idOrSlug: string, storeId: string): Promise<ProductDetail | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      return this.repo.getProductById(idOrSlug, storeId);
    }
    return this.repo.getProductBySlug(idOrSlug, storeId);
  }

  async createProductWithVariants(
    storeId: string,
    data: {
      name: string;
      description?: string;
      categoryId?: string;
      status?: "draft" | "published" | "archived";
      seoTitle?: string;
      seoDescription?: string;
      variants: {
        sku: string;
        title: string;
        price: number;
        compareAtPrice?: number;
        costPrice?: number;
        stock?: number;
        weight?: number;
        barcode?: string;
      }[];
      images?: { url: string; altText?: string; position?: number }[];
      collectionIds?: string[];
    },
  ): Promise<ProductDetail> {
    const slug = await this.generateUniqueSlug(storeId, data.name);

    const productPayload: NewProduct = {
      storeId,
      name: data.name,
      slug,
      description: data.description ?? null,
      categoryId: data.categoryId ?? null,
      status: data.status ?? "draft",
      seoTitle: data.seoTitle ?? data.name,
      seoDescription: data.seoDescription ?? data.description?.slice(0, 160) ?? null,
    };

    const variantsPayload: Omit<NewProductVariant, "productId">[] = data.variants.map((v) => ({
      storeId,
      sku: v.sku,
      title: v.title,
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? null,
      costPrice: v.costPrice ?? null,
      currency: "IDR",
      stock: v.stock ?? 0,
      reservedStock: 0,
      weight: v.weight ?? null,
      barcode: v.barcode ?? null,
    }));

    const imagesPayload: Omit<NewProductImage, "productId">[] = (data.images ?? []).map(
      (img, idx) => ({
        url: img.url,
        altText: img.altText ?? null,
        position: img.position ?? idx,
        variantId: null,
      }),
    );

    const result = await this.repo.createProduct(
      productPayload,
      variantsPayload,
      imagesPayload,
      data.collectionIds ?? [],
    );

    // Revalidate cache
    try {
      revalidateTag(`store-${storeId}-catalog`, "max");
    } catch {
      // Ignore outside request cycle
    }

    return result;
  }

  async updateProduct(id: string, storeId: string, data: Partial<NewProduct>): Promise<void> {
    await this.repo.updateProduct(id, storeId, data);

    try {
      revalidateTag(`product-${id}`, "max");
      revalidateTag(`store-${storeId}-catalog`, "max");
    } catch {
      // Ignore outside request cycle
    }
  }

  async deleteProduct(id: string, storeId: string): Promise<boolean> {
    const success = await this.repo.softDeleteProduct(id, storeId);
    if (success) {
      try {
        revalidateTag(`product-${id}`, "max");
        revalidateTag(`store-${storeId}-catalog`, "max");
      } catch {
        // Ignore outside request cycle
      }
    }
    return success;
  }
}

export const catalogService = new CatalogService();
