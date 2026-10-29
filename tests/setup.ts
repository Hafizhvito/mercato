import { afterAll, beforeAll } from "vitest";
import { pool } from "@/lib/db";

beforeAll(async () => {
  const testUrl = process.env.TEST_DATABASE_URL;
  const devUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Refusing to run tests without explicit test database configuration.",
    );
  }

  if (devUrl) {
    try {
      const parsedDev = new URL(devUrl);
      const parsedTest = new URL(testUrl);
      if (parsedDev.host === parsedTest.host && parsedDev.pathname === parsedTest.pathname) {
        throw new Error(
          "TEST_DATABASE_URL and DATABASE_URL point to the same database. Refusing to run tests against primary/development database.",
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("same database")) {
        throw err;
      }
    }
  }
});

afterAll(async () => {
  try {
    await pool.end();
  } catch {
    // Ignore pool shutdown errors
  }
});
