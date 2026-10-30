import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Item 12: Seeded Catalog & Collection Assets Verification", () => {
  it("verifies all seeded products and collections use valid, existing local assets", () => {
    const seedCatalogPath = path.resolve(process.cwd(), "src/lib/db/seed-catalog.ts");
    const seedContent = fs.readFileSync(seedCatalogPath, "utf-8");

    // Extract all image URLs from seed-catalog.ts
    const imageUrlMatches = [
      ...seedContent.matchAll(/imageUrl:\s*["']([^"']+)["']/g),
      ...seedContent.matchAll(/images:\s*\[\s*["']([^"']+)["']/g),
    ];

    expect(imageUrlMatches.length).toBeGreaterThanOrEqual(28); // 4 collections + 24 products

    const publicDir = path.resolve(process.cwd(), "public");

    for (const match of imageUrlMatches) {
      const url = match[1];

      // Must NOT be an external hotlink (especially Unsplash)
      expect(url).not.toContain("unsplash.com");

      if (url?.startsWith("/")) {
        const localPath = path.join(publicDir, url.slice(1));
        const exists = fs.existsSync(localPath);
        expect(exists).toBe(true);

        const stats = fs.statSync(localPath);
        expect(stats.size).toBeGreaterThan(100);

        const content = fs.readFileSync(localPath, "utf-8");
        expect(content).toContain("<svg");
        expect(content).toContain("</svg>");
      }
    }
  });

  it("verifies next.config.ts does not allow unsplash remote patterns", () => {
    const nextConfigPath = path.resolve(process.cwd(), "next.config.ts");
    const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");

    expect(nextConfigContent).not.toContain("images.unsplash.com");
    expect(nextConfigContent).toContain("dangerouslyAllowSVG: true");
  });

  it("verifies rewrite-legacy-images script exists with safety guards and confirmation requirement", () => {
    const scriptPath = path.resolve(process.cwd(), "src/lib/db/rewrite-legacy-images.ts");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const scriptContent = fs.readFileSync(scriptPath, "utf-8");
    expect(scriptContent).toContain("--confirm");
    expect(scriptContent).toContain("production");
    expect(scriptContent).toContain("maskHost");
  });
});
