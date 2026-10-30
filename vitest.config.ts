import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load local environment for testing if present
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    env: {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test_secret_key_minimum_32_characters_long_for_auth",
      NODE_ENV: "test",
      SKIP_ENV_VALIDATION: "true",
    },
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    server: {
      deps: {
        inline: ["next-intl"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "next/server": path.resolve(import.meta.dirname, "./node_modules/next/server.js"),
    },
  },
});
