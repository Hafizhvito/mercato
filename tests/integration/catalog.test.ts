import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import * as schema from "../../src/lib/db/schema";
import { searchService } from "../../src/lib/search";
import { LocalStorageService, validateFileSignature } from "../../src/lib/storage";
import { catalogRepository } from "../../src/modules/catalog/repository";
import { catalogService } from "../../src/modules/catalog/service";

describe("Phase 2: Catalog, Storage, and Search Services", () => {
  let testStoreId: string;
  let testCategoryId: string;
  let testCollectionId: string;
  let createdProductId: string;

  beforeAll(async () => {
    // Provision test store if not present
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Test Catalog Store",
        slug: `test-catalog-store-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();

    if (store) {
      testStoreId = store.id;
    } else {
      throw new Error("Failed to insert test store record");
    }

    // Provision test category
    const category = await catalogRepository.createCategory({
      storeId: testStoreId,
      name: "Pakaian Pengujian",
      slug: `pakaian-pengujian-${Date.now()}`,
      description: "Kategori untuk uji coba integrasi",
    });
    testCategoryId = category.id;

    // Provision test collection
    const collection = await catalogRepository.createCollection({
      storeId: testStoreId,
      name: "Koleksi Eksklusif Uji",
      slug: `koleksi-uji-${Date.now()}`,
      description: "Koleksi khusus testing integrasi",
    });
    testCollectionId = collection.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testStoreId) {
      await db.delete(schema.stores).where(eq(schema.stores.id, testStoreId));
    }
  });

  describe("Option-Variant Matrix Generator", () => {
    it("generates Cartesian product of multiple options with unique SKUs", () => {
      const options = [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Black", "White"] },
      ];

      const variants = catalogService.generateVariantsFromOptions(options, "SHIRT", 150000);

      expect(variants).toHaveLength(4);
      expect(variants.map((v) => v.title)).toEqual([
        "S / Black",
        "S / White",
        "M / Black",
        "M / White",
      ]);

      // All SKUs must be unique
      const skus = variants.map((v) => v.sku);
      const uniqueSkus = new Set(skus);
      expect(uniqueSkus.size).toBe(4);
    });

    it("generates a fallback default variant when no options are provided", () => {
      const variants = catalogService.generateVariantsFromOptions([], "ITEM", 200000);
      expect(variants).toHaveLength(1);
      expect(variants[0]?.title).toBe("Default Variant");
      expect(variants[0]?.sku).toBe("ITEM-DEF");
      expect(variants[0]?.price).toBe(200000);
    });
  });

  describe("Storage Service and File Signature Validation", () => {
    it("correctly identifies valid and invalid image magic byte signatures", () => {
      // JPEG magic header: ffd8ff
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(validateFileSignature(validJpeg, "image/jpeg")).toBe(true);

      // PNG magic header: 89504e47
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateFileSignature(validPng, "image/png")).toBe(true);

      // GIF magic header: 47494638
      const validGif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
      expect(validateFileSignature(validGif, "image/gif")).toBe(true);

      // Corrupted / forged file pretending to be PNG
      const forgedFile = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      expect(validateFileSignature(forgedFile, "image/png")).toBe(false);
    });

    it("saves and deletes file using LocalStorageService adapter", async () => {
      const storage = new LocalStorageService();
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const uploadResult = await storage.uploadFile(validPng, {
        originalName: "test.png",
        contentType: "image/png",
      });

      expect(uploadResult.key).toBeDefined();
      expect(uploadResult.url).toContain("/uploads/");

      // Delete file
      await expect(storage.deleteFile(uploadResult.key)).resolves.not.toThrow();
    });
  });

  describe("Product Lifecycle & Database Persistence", () => {
    it("creates a published product with multiple variants and collection association", async () => {
      const product = await catalogService.createProductWithVariants(testStoreId, {
        name: "Kemeja Flanel Kasual Uji",
        description: "Kemeja flanel katun hangat untuk pengujian",
        categoryId: testCategoryId,
        status: "published",
        variants: [
          {
            sku: `FLN-RED-M-${Date.now()}`,
            title: "Red / M",
            price: 189000,
            stock: 15,
          },
          {
            sku: `FLN-RED-L-${Date.now()}`,
            title: "Red / L",
            price: 189000,
            stock: 20,
          },
        ],
        images: [
          {
            url: "/images/products/kemeja-batik-solo.svg",
            altText: "Kemeja Flanel",
            position: 0,
          },
        ],
        collectionIds: [testCollectionId],
      });

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe("Kemeja Flanel Kasual Uji");
      expect(product.variants).toHaveLength(2);
      expect(product.images).toHaveLength(1);
      createdProductId = product.id;
    });

    it("retrieves product detail by slug with resolved associations", async () => {
      const fetched = await catalogRepository.getProductById(createdProductId, testStoreId);

      expect(fetched).toBeDefined();
      expect(fetched?.category?.id).toBe(testCategoryId);
      expect(fetched?.collections).toHaveLength(1);
      expect(fetched?.collections[0]?.id).toBe(testCollectionId);
    });

    it("performs full-text and trigram fuzzy search", async () => {
      // Exact search query
      const searchRes = await searchService.searchProducts({
        storeId: testStoreId,
        query: "Flanel Kasual",
      });

      expect(searchRes.items.length).toBeGreaterThanOrEqual(1);
      expect(searchRes.items[0]?.name).toContain("Flanel");

      // Fuzzy search with typo ("Flanl" -> "Flanel")
      const fuzzyRes = await searchService.searchProducts({
        storeId: testStoreId,
        query: "Flanl",
      });

      expect(fuzzyRes.items.length).toBeGreaterThanOrEqual(1);
    });

    it("provides autocomplete suggestions", async () => {
      const autocomplete = await searchService.autocomplete(testStoreId, "Flan", 5);
      expect(autocomplete.length).toBeGreaterThanOrEqual(1);
      expect(autocomplete[0]?.name).toContain("Flanel");
    });

    it("soft deletes product and its variants", async () => {
      const deleted = await catalogService.deleteProduct(createdProductId, testStoreId);
      expect(deleted).toBe(true);

      // Verify soft delete in DB
      const [productRow] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, createdProductId));

      expect(productRow?.deletedAt).not.toBeNull();

      // Ensure search service excludes soft deleted products
      const searchRes = await searchService.searchProducts({
        storeId: testStoreId,
        query: "Flanel",
      });
      expect(searchRes.items.find((p) => p.id === createdProductId)).toBeUndefined();
    });
  });
});
