import { eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let publishedProducts: { slug: string; updatedAt: Date }[] = [];
  let activeCollections: { slug: string; updatedAt: Date }[] = [];

  try {
    const [products, collections] = await Promise.all([
      db
        .select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt })
        .from(schema.products)
        .where(eq(schema.products.status, "published")),
      db
        .select({ slug: schema.collections.slug, updatedAt: schema.collections.updatedAt })
        .from(schema.collections),
    ]);
    publishedProducts = products;
    activeCollections = collections;
  } catch {
    // If database unavailable during build/static analysis, return static routes
  }

  const productRoutes: MetadataRoute.Sitemap = publishedProducts.flatMap((p) => [
    {
      url: `${baseUrl}/id/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/en/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
  ]);

  const collectionRoutes: MetadataRoute.Sitemap = activeCollections.flatMap((c) => [
    {
      url: `${baseUrl}/id/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/en/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/id`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/id/catalog`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/en/catalog`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
  ];

  return [...staticRoutes, ...collectionRoutes, ...productRoutes];
}
