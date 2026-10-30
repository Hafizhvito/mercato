"use server";

import { asc, eq } from "drizzle-orm";
import { unstable_cache as cache } from "next/cache";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

function safeCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options?: { revalidate?: number | false; tags?: string[] },
): T {
  if (process.env.NODE_ENV === "test") {
    return fn;
  }
  return cache(fn, keyParts, options) as T;
}

export async function getProvinces() {
  return db
    .select({
      code: schema.indonesianProvinces.code,
      name: schema.indonesianProvinces.name,
    })
    .from(schema.indonesianProvinces)
    .orderBy(asc(schema.indonesianProvinces.name));
}

export async function getRegencies(provinceCode: string) {
  if (!provinceCode) return [];
  return db
    .select({
      code: schema.indonesianRegencies.code,
      provinceCode: schema.indonesianRegencies.provinceCode,
      name: schema.indonesianRegencies.name,
    })
    .from(schema.indonesianRegencies)
    .where(eq(schema.indonesianRegencies.provinceCode, provinceCode))
    .orderBy(asc(schema.indonesianRegencies.name));
}

export async function getDistricts(regencyCode: string) {
  if (!regencyCode) return [];
  return db
    .select({
      code: schema.indonesianDistricts.code,
      regencyCode: schema.indonesianDistricts.regencyCode,
      name: schema.indonesianDistricts.name,
    })
    .from(schema.indonesianDistricts)
    .where(eq(schema.indonesianDistricts.regencyCode, regencyCode))
    .orderBy(asc(schema.indonesianDistricts.name));
}

export const getProvincesAction = safeCache(getProvinces, ["indonesian-provinces"], {
  revalidate: 86400,
  tags: ["regions"],
});

export const getRegenciesAction = safeCache(getRegencies, ["indonesian-regencies"], {
  revalidate: 86400,
  tags: ["regions"],
});

export const getDistrictsAction = safeCache(getDistricts, ["indonesian-districts"], {
  revalidate: 86400,
  tags: ["regions"],
});
