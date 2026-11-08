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

function createResilientPool(connStr: string | undefined): Pool {
  const instance = new Pool({
    connectionString: connStr,
    max: env.NODE_ENV === "production" ? 20 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });

  instance.on("error", () => {
    // Prevent unhandled error crashes when remote Postgres proxy resets an idle socket
  });

  const rawQuery = instance.query.bind(instance) as (...args: unknown[]) => unknown;
  const isTransientSocketError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const e = err as { code?: string; message?: string; cause?: unknown };
    const code = e.code ?? "";
    const msg = e.message ?? "";
    if (
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      code === "EPIPE" ||
      msg.includes("ECONNRESET") ||
      msg.includes("Connection terminated unexpectedly") ||
      msg.includes("Client has encountered a connection error")
    ) {
      return true;
    }
    return e.cause ? isTransientSocketError(e.cause) : false;
  };

  (instance as unknown as { query: (...args: unknown[]) => unknown }).query = (
    ...args: unknown[]
  ) => {
    const hasCallback = args.some((arg) => typeof arg === "function");
    if (hasCallback) {
      return rawQuery(...args);
    }
    const executeWithRetry = async (attempt: number): Promise<unknown> => {
      try {
        return await (rawQuery(...args) as Promise<unknown>);
      } catch (err) {
        if (attempt < 3 && isTransientSocketError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
          return executeWithRetry(attempt + 1);
        }
        throw err;
      }
    };
    return executeWithRetry(1);
  };

  return instance;
}

export const pool = globalForDb.pool ?? createResilientPool(connectionString);

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
