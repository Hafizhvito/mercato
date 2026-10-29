import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const connectionString =
  (process.env.NODE_ENV === "test" || env.NODE_ENV === "test") && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : env.DATABASE_URL;

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
