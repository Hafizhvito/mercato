import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { searchRateLimiter } from "@/lib/cache/ratelimit";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { searchService } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const forwardedFor = reqHeaders.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "127.0.0.1";

    // Rate limit autocomplete queries (30 per min)
    const rateLimitResult = await searchRateLimiter.limit(
      `search:autocomplete:${ip ?? "anonymous"}`,
    );

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") ?? "";

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Default to the first primary store if storeId is not explicitly provided
    let storeId = searchParams.get("storeId");
    if (!storeId) {
      const [defaultStore] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
      storeId = defaultStore?.id ?? "";
    }

    if (!storeId) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchService.autocomplete(storeId, query, 6);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Autocomplete search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
