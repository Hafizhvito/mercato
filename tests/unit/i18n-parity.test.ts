import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("i18n Messages Parity Test", () => {
  const idPath = path.resolve(process.cwd(), "messages/id.json");
  const enPath = path.resolve(process.cwd(), "messages/en.json");

  it("should have both messages/id.json and messages/en.json present", () => {
    expect(fs.existsSync(idPath)).toBe(true);
    expect(fs.existsSync(enPath)).toBe(true);
  });

  it("should parse valid JSON from both translation files", () => {
    const idContent = fs.readFileSync(idPath, "utf-8");
    const enContent = fs.readFileSync(enPath, "utf-8");

    expect(() => JSON.parse(idContent)).not.toThrow();
    expect(() => JSON.parse(enContent)).not.toThrow();
  });

  it("should have exact recursive key parity between id.json and en.json", () => {
    const idMessages = JSON.parse(fs.readFileSync(idPath, "utf-8"));
    const enMessages = JSON.parse(fs.readFileSync(enPath, "utf-8"));

    const idKeys = getAllKeys(idMessages);
    const enKeys = getAllKeys(enMessages);

    const missingInEn = idKeys.filter((k) => !enKeys.includes(k));
    const missingInId = enKeys.filter((k) => !idKeys.includes(k));

    expect(
      missingInEn,
      `Keys present in id.json but missing in en.json: ${missingInEn.join(", ")}`,
    ).toEqual([]);
    expect(
      missingInId,
      `Keys present in en.json but missing in id.json: ${missingInId.join(", ")}`,
    ).toEqual([]);
    expect(idKeys).toEqual(enKeys);
    expect(idKeys.length).toBeGreaterThan(100);
  });

  it("should have no hardcoded Indonesian user-facing strings in storefront account pages", () => {
    const accountDir = path.resolve(process.cwd(), "src/app/[locale]/account");
    const filesToScan = [
      path.join(accountDir, "layout.tsx"),
      path.join(accountDir, "page.tsx"),
      path.join(accountDir, "ProfileForm.tsx"),
      path.join(accountDir, "addresses/page.tsx"),
      path.join(accountDir, "addresses/AddressBookView.tsx"),
      path.join(accountDir, "orders/page.tsx"),
      path.join(accountDir, "orders/[orderNumber]/page.tsx"),
    ];

    const forbiddenPhrases = [
      "Perbarui informasi nama",
      "Gagal memperbarui profil",
      "Alamat email terikat pada akun",
      "Daftar alamat tersimpan",
      "Alamat Pilihan",
      "-- Pilih Provinsi --",
      "-- Pilih Kota / Kab --",
      "-- Pilih Kecamatan --",
      "Jadikan sebagai alamat pengiriman utama",
      "Pantau status pesanan",
      "Mulai Belanja",
      "Informasi Resi Pengiriman",
      "Item Pesanan",
    ];

    for (const filePath of filesToScan) {
      expect(fs.existsSync(filePath)).toBe(true);
      const source = fs.readFileSync(filePath, "utf-8");
      for (const phrase of forbiddenPhrases) {
        expect(
          source,
          `Found hardcoded phrase '${phrase}' in ${path.basename(filePath)}`,
        ).not.toContain(phrase);
      }
    }
  });
});
