import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

interface RegionData {
  provinces: { code: string; name: string }[];
  regencies: { code: string; provinceCode: string; name: string }[];
  districts: { code: string; regencyCode: string; name: string }[];
}

export async function importIndonesianRegions() {
  console.log("Starting Indonesian Administrative Regions Import...");

  const dataPath = path.join(process.cwd(), "data", "indonesia-regions-complete.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Region data file not found at ${dataPath}. Please run download script first.`);
  }

  const raw = fs.readFileSync(dataPath, "utf-8");
  const data: RegionData = JSON.parse(raw);

  console.log(
    `Loaded ${data.provinces.length} provinces, ${data.regencies.length} regencies, and ${data.districts.length} districts.`,
  );

  // 1. Insert Provinces
  console.log("Importing provinces...");
  for (let i = 0; i < data.provinces.length; i += 100) {
    const chunk = data.provinces.slice(i, i + 100);
    await db.insert(schema.indonesianProvinces).values(chunk).onConflictDoNothing();
  }

  // 2. Insert Regencies
  console.log("Importing regencies/cities...");
  for (let i = 0; i < data.regencies.length; i += 100) {
    const chunk = data.regencies.slice(i, i + 100);
    await db.insert(schema.indonesianRegencies).values(chunk).onConflictDoNothing();
  }

  // 3. Insert Districts
  console.log("Importing districts...");
  for (let i = 0; i < data.districts.length; i += 250) {
    const chunk = data.districts.slice(i, i + 250);
    await db.insert(schema.indonesianDistricts).values(chunk).onConflictDoNothing();
  }

  console.log("Successfully imported Indonesian administrative regions into database.");
}

async function main() {
  try {
    await importIndonesianRegions();
    process.exit(0);
  } catch (err) {
    console.error("Failed to import regions:", err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes("import-indonesian-regions")) {
  main();
}
