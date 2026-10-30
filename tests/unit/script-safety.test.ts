import { describe, expect, it } from "vitest";
import { assertSafeTarget, getMaskedTarget, maskHost } from "@/lib/db/script-safety";

describe("Item 11 Unit: Script Safety & Database Target Confirmation Guard", () => {
  const sampleNeonUrl =
    "postgresql://neondb_owner:secret_password@ep-sweet-forest-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const sampleLocalUrl = "postgresql://postgres:pass@localhost:5432/mercato_ci_dev";

  describe("maskHost and getMaskedTarget", () => {
    it("masks remote hostnames without leaking full hashes or credentials", () => {
      const masked = maskHost("ep-sweet-forest-123456.ap-southeast-1.aws.neon.tech");
      expect(masked).toBe("ep-sw***tech");
      expect(masked).not.toContain("forest");
      expect(masked).not.toContain("123456");
    });

    it("leaves localhost and 127.0.0.1 recognizable", () => {
      expect(maskHost("localhost:5432")).toBe("localhost:5432");
      expect(maskHost("127.0.0.1:5432")).toBe("127.0.0.1:5432");
    });

    it("generates correct masked target string combining masked host and db name", () => {
      expect(getMaskedTarget(sampleNeonUrl)).toBe("ep-sw***tech/neondb");
      expect(getMaskedTarget(sampleLocalUrl)).toBe("localhost:5432/mercato_ci_dev");
    });
  });

  describe("assertSafeTarget Guard Enforcement", () => {
    it("refuses execution when NODE_ENV is production", () => {
      const origEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      try {
        expect(() =>
          assertSafeTarget({
            targetUrl: sampleNeonUrl,
            scriptName: "db:seed",
            argv: ["node", "script.js", "--confirm-target=ep-sw***tech/neondb"],
          }),
        ).toThrow(/prohibited when NODE_ENV is 'production'/);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      }
    });

    it("returns confirmed: false when --confirm-target is omitted", () => {
      const result = assertSafeTarget({
        targetUrl: sampleNeonUrl,
        scriptName: "db:seed",
        argv: ["node", "script.js"],
      });

      expect(result.confirmed).toBe(false);
      expect(result.maskedTarget).toBe("ep-sw***tech/neondb");
    });

    it("strictly rejects legacy bare --confirm flag", () => {
      expect(() =>
        assertSafeTarget({
          targetUrl: sampleNeonUrl,
          scriptName: "db:seed",
          argv: ["node", "script.js", "--confirm"],
        }),
      ).toThrow(/Bare --confirm is deprecated and rejected/);
    });

    it("rejects mismatched --confirm-target value", () => {
      expect(() =>
        assertSafeTarget({
          targetUrl: sampleNeonUrl,
          scriptName: "db:seed",
          argv: ["node", "script.js", "--confirm-target=wrong-target/db"],
        }),
      ).toThrow(/Target mismatch for script/);
    });

    it("accepts execution when --confirm-target matches the actual masked target", () => {
      const result = assertSafeTarget({
        targetUrl: sampleNeonUrl,
        scriptName: "db:seed",
        argv: ["node", "script.js", "--confirm-target=ep-sw***tech/neondb"],
      });

      expect(result.confirmed).toBe(true);
      expect(result.maskedTarget).toBe("ep-sw***tech/neondb");
    });
  });
});
