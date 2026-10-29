import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "@/lib/db/schema";

export const productStatusEnum = pgEnum("product_status", ["draft", "published", "archived"]);

// Categories (Hierarchical product taxonomy)
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("categories_store_slug_idx").on(table.storeId, table.slug),
    index("categories_parent_idx").on(table.parentId),
  ],
);

// Collections (Thematic groupings, e.g. "Summer Collection", "Best Sellers")
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("collections_store_slug_idx").on(table.storeId, table.slug)],
);

// Products
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    status: productStatusEnum("status").default("draft").notNull(),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("products_store_slug_idx").on(table.storeId, table.slug),
    index("products_store_status_idx").on(table.storeId, table.status),
    index("products_category_idx").on(table.categoryId),
  ],
);

// Product Options (e.g. Size, Color, Material)
export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [index("product_options_product_idx").on(table.productId)],
);

// Product Option Values (e.g. S, M, L, Red, Navy)
export const productOptionValues = pgTable(
  "product_option_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => productOptions.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 100 }).notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [index("product_option_values_option_idx").on(table.optionId)],
);

// Product Variants (SKU, pricing in integer minor units, and inventory tracking)
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    costPrice: integer("cost_price"),
    currency: varchar("currency", { length: 3 }).default("IDR").notNull(),
    stock: integer("stock").default(0).notNull(),
    reservedStock: integer("reserved_stock").default(0).notNull(),
    weight: integer("weight"),
    barcode: varchar("barcode", { length: 100 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_variants_store_sku_idx").on(table.storeId, table.sku),
    index("product_variants_product_idx").on(table.productId),
  ],
);

// Product Variant Option Values (Association between variant and selected option values)
export const productVariantOptionValues = pgTable(
  "product_variant_option_values",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    optionValueId: uuid("option_value_id")
      .notNull()
      .references(() => productOptionValues.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.variantId, table.optionValueId],
    }),
  ],
);

// Product Images (Ordered with variant association option)
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 255 }),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("product_images_product_idx").on(table.productId),
    index("product_images_position_idx").on(table.productId, table.position),
  ],
);

// Products to Collections Join Table
export const productsToCollections = pgTable(
  "products_to_collections",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.collectionId],
    }),
    index("products_to_collections_collection_idx").on(table.collectionId),
  ],
);

// Type inferences
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductOption = typeof productOptions.$inferSelect;
export type NewProductOption = typeof productOptions.$inferInsert;
export type ProductOptionValue = typeof productOptionValues.$inferSelect;
export type NewProductOptionValue = typeof productOptionValues.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
