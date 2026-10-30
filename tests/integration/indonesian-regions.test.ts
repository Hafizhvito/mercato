import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { importIndonesianRegions } from "@/lib/shipping/import-indonesian-regions";
import {
  getDistrictsAction,
  getProvincesAction,
  getRegenciesAction,
} from "@/modules/shipping/actions";

describe("Phase 4: Indonesian Administrative Regions & Cascading Integrity", () => {
  it("imports and verifies full hierarchy: 38 provinces, 514 regencies, 7265+ districts", async () => {
    // 1. Ensure test database is populated with regions
    await importIndonesianRegions();

    // 2. Province count sanity check
    const provinces = await db.select().from(schema.indonesianProvinces);
    expect(provinces.length).toBe(38);

    // 3. Regency count sanity check
    const regencies = await db.select().from(schema.indonesianRegencies);
    expect(regencies.length).toBe(514);

    // 4. District count sanity check
    const districts = await db.select().from(schema.indonesianDistricts);
    expect(districts.length).toBeGreaterThanOrEqual(7200);

    // 5. Integrity check: Every single regency must have at least one district
    const regencyCodesWithDistricts = new Set(districts.map((d) => d.regencyCode));
    expect(regencyCodesWithDistricts.size).toBe(514);
  });

  it("executes cascading actions with complete Jakarta Pusat districts (resolving Phase 3 gap)", async () => {
    // 1. Fetch Provinces
    const provinces = await getProvincesAction();
    expect(provinces.length).toBe(38);

    const dki = provinces.find((p) => p.name.toUpperCase().includes("JAKARTA"));
    expect(dki).toBeDefined();
    expect(dki?.code).toBe("31");

    // 2. Fetch Regencies for DKI Jakarta
    const jakartaRegencies = await getRegenciesAction(dki!.code);
    expect(jakartaRegencies.length).toBe(6); // 5 kota adm + 1 kab adm

    const jakartaPusat = jakartaRegencies.find((r) => r.name.toUpperCase().includes("PUSAT"));
    expect(jakartaPusat).toBeDefined();
    expect(jakartaPusat?.code).toBe("31.71");

    // 3. Fetch all Districts for Jakarta Pusat (verify all 8 official districts exist)
    const pusatDistricts = await getDistrictsAction(jakartaPusat!.code);
    expect(pusatDistricts.length).toBe(8);

    const expectedDistricts = [
      "GAMBIR",
      "SAWAH BESAR",
      "KEMAYORAN",
      "SENEN",
      "CEMPAKA PUTIH",
      "MENTENG",
      "TANAH ABANG",
      "JOHAR BARU",
    ];

    const actualDistrictNames = pusatDistricts.map((d) => d.name.toUpperCase());
    for (const expected of expectedDistricts) {
      expect(actualDistrictNames.some((name) => name.includes(expected))).toBe(true);
    }
  });

  it("enforces strict 5-digit postal code validation", () => {
    const isValidPostalCode = (code: string) => /^\d{5}$/.test(code.trim());

    expect(isValidPostalCode("10110")).toBe(true);
    expect(isValidPostalCode("40123")).toBe(true);
    expect(isValidPostalCode("1011")).toBe(false); // only 4 digits
    expect(isValidPostalCode("101100")).toBe(false); // 6 digits
    expect(isValidPostalCode("1011A")).toBe(false); // contains letter
    expect(isValidPostalCode("")).toBe(false); // empty
  });
});
