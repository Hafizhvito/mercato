import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Refusing to run migrations without explicit test database.",
  );
}

if (process.env.DATABASE_URL) {
  try {
    const devUrl = new URL(process.env.DATABASE_URL);
    const testUrl = new URL(process.env.TEST_DATABASE_URL);
    if (devUrl.host === testUrl.host && devUrl.pathname === testUrl.pathname) {
      throw new Error(
        "TEST_DATABASE_URL and DATABASE_URL point to the same database. Refusing to run test operations on primary database.",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("same database")) {
      throw err;
    }
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TEST_DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
