import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function normalizeConnectionString(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const sslmode = parsed.searchParams.get("sslmode");
    if (sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
  } catch {
    return rawUrl.replace(/sslmode=(?:require|prefer|verify-ca)/g, "sslmode=verify-full");
  }
  return rawUrl;
}

const rawConnectionString =
  (process.env.NODE_ENV === "test" || env.NODE_ENV === "test") && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : env.DATABASE_URL;

const connectionString = normalizeConnectionString(rawConnectionString);

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: env.NODE_ENV === "production" ? 20 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
