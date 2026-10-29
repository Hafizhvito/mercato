import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface SearchProductResult {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  primaryImage: string | null;
  rank?: number;
}

export interface AutocompleteResult {
  id: string;
  name: string;
  slug: string;
  primaryImage: string | null;
  minPrice: number;
  currency: string;
}

export interface SearchOptions {
  storeId: string;
  query?: string;
  categoryId?: string;
  collectionId?: string;
  status?: "draft" | "published" | "archived";
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
  limit?: number;
  offset?: number;
}

export interface SearchService {
  searchProducts(options: SearchOptions): Promise<{
    items: SearchProductResult[];
    total: number;
  }>;
  autocomplete(storeId: string, query: string, limit?: number): Promise<AutocompleteResult[]>;
}

interface DbSearchRow {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  min_price: number | string | null;
  max_price: number | string | null;
  currency: string | null;
  primary_image: string | null;
  rank_score: number | string;
  total_count: number | string;
}

interface DbAutocompleteRow {
  id: string;
  name: string;
  slug: string;
  min_price: number | string | null;
  currency: string | null;
  primary_image: string | null;
}

export class PostgresSearchService implements SearchService {
  async searchProducts(options: SearchOptions): Promise<{
    items: SearchProductResult[];
    total: number;
  }> {
    const {
      storeId,
      query = "",
      categoryId,
      collectionId,
      status = "published",
      minPrice,
      maxPrice,
      sort = "relevance",
      limit = 20,
      offset = 0,
    } = options;

    const trimmedQuery = query.trim();
    const hasSearchQuery = trimmedQuery.length > 0;

    // Build dynamic SQL conditions
    const whereConditions = [sql`p.store_id = ${storeId}`, sql`p.deleted_at IS NULL`];

    if (status) {
      whereConditions.push(sql`p.status = ${status}`);
    }

    if (categoryId) {
      whereConditions.push(sql`p.category_id = ${categoryId}`);
    }

    if (collectionId) {
      whereConditions.push(
        sql`EXISTS (SELECT 1 FROM products_to_collections ptc WHERE ptc.product_id = p.id AND ptc.collection_id = ${collectionId})`,
      );
    }

    let searchScoreSql = sql`0 AS rank_score`;

    if (hasSearchQuery) {
      // Hybrid scoring combining full-text ts_rank with trigram similarity for fuzzy match resilience
      searchScoreSql = sql`(
        ts_rank(to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')), plainto_tsquery('simple', ${trimmedQuery})) * 2.0
        + similarity(p.name, ${trimmedQuery}) * 1.5
      ) AS rank_score`;

      whereConditions.push(
        sql`(
          to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('simple', ${trimmedQuery})
          OR similarity(p.name, ${trimmedQuery}) > 0.15
          OR p.name ILIKE ${`%${trimmedQuery}%`}
        )`,
      );
    }

    // Pricing conditions from variants
    const priceWhereConditions = [sql`pv.deleted_at IS NULL`];
    if (minPrice !== undefined) {
      priceWhereConditions.push(sql`pv.price >= ${minPrice}`);
    }
    if (maxPrice !== undefined) {
      priceWhereConditions.push(sql`pv.price <= ${maxPrice}`);
    }

    // Determine sorting clause
    let orderBySql = sql`created_at DESC`;
    if (sort === "relevance" && hasSearchQuery) {
      orderBySql = sql`rank_score DESC, created_at DESC`;
    } else if (sort === "price_asc") {
      orderBySql = sql`min_price ASC, created_at DESC`;
    } else if (sort === "price_desc") {
      orderBySql = sql`min_price DESC, created_at DESC`;
    } else if (sort === "newest") {
      orderBySql = sql`created_at DESC`;
    }

    const whereClause = sql.join(whereConditions, sql` AND `);
    const priceWhereClause = sql.join(priceWhereConditions, sql` AND `);

    // Primary query aggregating variants and images
    const queryResult = await db.execute<{
      id: string;
      store_id: string;
      name: string;
      slug: string;
      description: string | null;
      status: string;
      min_price: number | string | null;
      max_price: number | string | null;
      currency: string | null;
      primary_image: string | null;
      rank_score: number | string;
      total_count: number | string;
    }>(sql`
      WITH filtered_products AS (
        SELECT 
          p.id,
          p.store_id,
          p.name,
          p.slug,
          p.description,
          p.status,
          p.created_at,
          ${searchScoreSql}
        FROM products p
        WHERE ${whereClause}
      ),
      product_aggregates AS (
        SELECT 
          fp.*,
          MIN(pv.price) AS min_price,
          MAX(pv.price) AS max_price,
          COALESCE(MAX(pv.currency), 'IDR') AS currency,
          (
            SELECT pi.url 
            FROM product_images pi 
            WHERE pi.product_id = fp.id 
            ORDER BY pi.position ASC 
            LIMIT 1
          ) AS primary_image,
          COUNT(*) OVER() AS total_count
        FROM filtered_products fp
        LEFT JOIN product_variants pv ON pv.product_id = fp.id AND ${priceWhereClause}
        GROUP BY fp.id, fp.store_id, fp.name, fp.slug, fp.description, fp.status, fp.created_at, fp.rank_score
        ${
          minPrice !== undefined || maxPrice !== undefined
            ? sql`HAVING MIN(pv.price) IS NOT NULL`
            : sql``
        }
      )
      SELECT * FROM product_aggregates
      ORDER BY ${orderBySql}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = ((queryResult as unknown as { rows: DbSearchRow[] }).rows ??
      queryResult) as DbSearchRow[];
    const firstRow = rows[0];
    const total = firstRow ? Number(firstRow.total_count) : 0;

    const items: SearchProductResult[] = rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      status: r.status,
      minPrice: Number(r.min_price ?? 0),
      maxPrice: Number(r.max_price ?? 0),
      currency: r.currency ?? "IDR",
      primaryImage: r.primary_image,
      rank: Number(r.rank_score ?? 0),
    }));

    return { items, total };
  }

  async autocomplete(storeId: string, query: string, limit = 6): Promise<AutocompleteResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    try {
      const result = await db.execute<{
        id: string;
        name: string;
        slug: string;
        min_price: number | string | null;
        currency: string | null;
        primary_image: string | null;
      }>(sql`
        SELECT 
          p.id,
          p.name,
          p.slug,
          MIN(pv.price) AS min_price,
          COALESCE(MAX(pv.currency), 'IDR') AS currency,
          (
            SELECT pi.url 
            FROM product_images pi 
            WHERE pi.product_id = p.id 
            ORDER BY pi.position ASC 
            LIMIT 1
          ) AS primary_image
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
        WHERE 
          p.store_id = ${storeId}
          AND p.deleted_at IS NULL
          AND p.status = 'published'
          AND (
            p.name ILIKE ${`%${trimmedQuery}%`}
            OR similarity(p.name, ${trimmedQuery}) > 0.2
          )
        GROUP BY p.id, p.name, p.slug
        ORDER BY similarity(p.name, ${trimmedQuery}) DESC, p.name ASC
        LIMIT ${limit}
      `);

      const rows = ((result as unknown as { rows: DbAutocompleteRow[] }).rows ??
        result) as DbAutocompleteRow[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        primaryImage: r.primary_image,
        minPrice: Number(r.min_price ?? 0),
        currency: r.currency ?? "IDR",
      }));
    } catch (err) {
      logger.error({ err, query }, "Autocomplete query failed");
      return [];
    }
  }
}

export const searchService: SearchService = new PostgresSearchService();
