import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_FALLBACK, isAllowedImageSrc } from "@/components/ui/SafeImage";

describe("Item 14.d Unit: SafeImage Component & Fallback Guard", () => {
  describe("isAllowedImageSrc Hostname Validation", () => {
    it("permits local relative paths", () => {
      expect(isAllowedImageSrc("/images/products/kemeja-batik-solo.svg")).toBe(true);
      expect(isAllowedImageSrc("/images/collections/terlaris.svg")).toBe(true);
      expect(isAllowedImageSrc("/uploads/sample.png")).toBe(true);
      expect(isAllowedImageSrc("./local.png")).toBe(true);
      expect(isAllowedImageSrc("../relative.jpg")).toBe(true);
    });

    it("permits data URIs", () => {
      expect(isAllowedImageSrc("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(true);
      expect(isAllowedImageSrc("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).toBe(true);
    });

    it("permits configured Cloudflare R2 and self-hosted storage domains", () => {
      expect(isAllowedImageSrc("https://mercato.r2.cloudflarestorage.com/products/img.webp")).toBe(
        true,
      );
      expect(isAllowedImageSrc("https://pub-sample123.r2.dev/products/img.webp")).toBe(true);
      expect(isAllowedImageSrc("https://assets.mercato.local/catalog/batik.webp")).toBe(true);
      expect(isAllowedImageSrc("http://localhost:3000/images/placeholder.svg")).toBe(true);
    });

    it("strictly rejects disallowed external image hosts including Unsplash", () => {
      // The exact error URL that crashed the homepage
      expect(
        isAllowedImageSrc(
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
        ),
      ).toBe(false);
      expect(isAllowedImageSrc("https://unsplash.com/photos/12345")).toBe(false);
      expect(isAllowedImageSrc("https://images.pexels.com/photos/12345")).toBe(false);
      expect(isAllowedImageSrc("https://malicious-site.com/hacked.png")).toBe(false);
    });

    it("rejects empty, null, undefined, and non-string inputs", () => {
      expect(isAllowedImageSrc("")).toBe(false);
      expect(isAllowedImageSrc("   ")).toBe(false);
      expect(isAllowedImageSrc(null)).toBe(false);
      expect(isAllowedImageSrc(undefined)).toBe(false);
      expect(isAllowedImageSrc(12345)).toBe(false);
      expect(isAllowedImageSrc({})).toBe(false);
    });

    it("verifies default fallback constant is configured to local asset", () => {
      expect(DEFAULT_IMAGE_FALLBACK).toBe("/images/placeholder.svg");
      expect(isAllowedImageSrc(DEFAULT_IMAGE_FALLBACK)).toBe(true);
    });
  });
});
