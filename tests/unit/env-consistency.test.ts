import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

// Recognized internal system/framework variables not required in application-specific .env.example
const ALLOWED_SYSTEM_VARIABLES = new Set([
  "NODE_ENV",
  "NEXT_PHASE",
  "SKIP_ENV_VALIDATION",
  "npm_lifecycle_event",
  "CONFIRM_CLEANUP",
]);

function extractEnvExampleKeys(filePath: string): {
  keys: Set<string>;
  keysWithComments: Set<string>;
} {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const keys = new Set<string>();
  const keysWithComments = new Set<string>();

  let hasRecentComment = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("#")) {
      hasRecentComment = true;
      continue;
    }
    if (!line) {
      hasRecentComment = false;
      continue;
    }

    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match?.[1]) {
      const key = match[1];
      keys.add(key);
      if (hasRecentComment) {
        keysWithComments.add(key);
      }
    }
  }

  return { keys, keysWithComments };
}

function scanSourceFilesForEnvUsage(dir: string): Set<string> {
  const accessedVariables = new Set<string>();

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next") {
          walk(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        // Matches process.env.VARIABLE_NAME
        const matches = fileContent.matchAll(/process\.env\.([A-Z0-9_]+)/g);
        for (const m of matches) {
          if (m[1]) {
            accessedVariables.add(m[1]);
          }
        }
      }
    }
  }

  walk(dir);
  return accessedVariables;
}

describe("Section A.1: Environment Variable Consistency & Schema Parity", () => {
  const repoRoot = path.resolve(__dirname, "../../");
  const envExamplePath = path.join(repoRoot, ".env.example");
  const srcDir = path.join(repoRoot, "src");

  it("ensures .env.example exists and contains descriptive comments for every variable", () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const { keys, keysWithComments } = extractEnvExampleKeys(envExamplePath);

    expect(keys.size).toBeGreaterThan(15);
    for (const key of keys) {
      expect(
        keysWithComments.has(key),
        `Variable ${key} in .env.example is missing a descriptive comment above it`,
      ).toBe(true);
    }
  });

  it("ensures all schema keys in src/lib/env.ts are documented in .env.example", () => {
    const { keys: exampleKeys } = extractEnvExampleKeys(envExamplePath);
    // Keys defined on the parsed env object
    const declaredKeys = Object.keys(env);

    for (const key of declaredKeys) {
      if (ALLOWED_SYSTEM_VARIABLES.has(key)) continue;
      expect(
        exampleKeys.has(key),
        `Schema variable '${key}' from src/lib/env.ts is missing from .env.example`,
      ).toBe(true);
    }
  });

  it("ensures AUTO_REFUND_ON_STOCK_EXHAUSTED is present in .env.example and schema", () => {
    const { keys: exampleKeys } = extractEnvExampleKeys(envExamplePath);
    expect(exampleKeys.has("AUTO_REFUND_ON_STOCK_EXHAUSTED")).toBe(true);
    expect("AUTO_REFUND_ON_STOCK_EXHAUSTED" in env).toBe(true);
  });

  it("fails if any source code in src/ reads an environment variable missing from schema or .env.example", () => {
    const accessedInSrc = scanSourceFilesForEnvUsage(srcDir);
    const { keys: exampleKeys } = extractEnvExampleKeys(envExamplePath);
    const schemaKeys = new Set(Object.keys(env));

    const missingFromSchema: string[] = [];
    const missingFromExample: string[] = [];

    for (const variable of accessedInSrc) {
      if (ALLOWED_SYSTEM_VARIABLES.has(variable)) continue;

      if (!schemaKeys.has(variable)) {
        missingFromSchema.push(variable);
      }
      if (!exampleKeys.has(variable)) {
        missingFromExample.push(variable);
      }
    }

    expect(
      missingFromSchema,
      `Environment variables read in src/ missing from src/lib/env.ts schema: ${missingFromSchema.join(", ")}`,
    ).toEqual([]);

    expect(
      missingFromExample,
      `Environment variables read in src/ missing from .env.example: ${missingFromExample.join(", ")}`,
    ).toEqual([]);
  });
});
