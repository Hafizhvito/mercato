import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { CalculateShippingParams, ShippingProvider, ShippingRate } from "../types";

export class FlatRateShippingProvider implements ShippingProvider {
  name = "flat_rate";

  async calculateRates(params: CalculateShippingParams): Promise<ShippingRate[]> {
    // Base weight tier (every 1000g adds base increment)
    const weightKg = Math.max(1, Math.ceil(params.weightGrams / 1000));

    // Check custom flat rates configured in store settings
    let customRates: { jabodetabek?: number; java?: number; luarJava?: number } | null = null;
    if (params.storeId) {
      try {
        const [store] = await db
          .select({ shippingFlatRates: schema.stores.shippingFlatRates })
          .from(schema.stores)
          .where(eq(schema.stores.id, params.storeId))
          .limit(1);
        if (store?.shippingFlatRates && typeof store.shippingFlatRates === "object") {
          customRates = store.shippingFlatRates as {
            jabodetabek?: number;
            java?: number;
            luarJava?: number;
          };
        }
      } catch {
        // Fallback to default rates if store query fails or in mock test context
      }
    }

    // Distance multiplier: check destination province
    const isJabodetabek =
      params.destination.province === "DKI Jakarta" ||
      params.destination.city.includes("Bogor") ||
      params.destination.city.includes("Depok") ||
      params.destination.city.includes("Tangerang") ||
      params.destination.city.includes("Bekasi");

    const isJava =
      isJabodetabek ||
      params.destination.province === "Jawa Barat" ||
      params.destination.province === "Jawa Tengah" ||
      params.destination.province === "DI Yogyakarta" ||
      params.destination.province === "Jawa Timur" ||
      params.destination.province === "Banten";

    let baseReguler: number;
    let baseExpress: number;

    if (isJabodetabek) {
      baseReguler = customRates?.jabodetabek ?? 10000;
      baseExpress = customRates?.jabodetabek ? customRates.jabodetabek * 2 : 20000;
    } else if (isJava) {
      baseReguler = customRates?.java ?? 15000;
      baseExpress = customRates?.java ? customRates.java * 2 : 30000;
    } else {
      baseReguler = customRates?.luarJava ?? 25000;
      baseExpress = customRates?.luarJava ? customRates.luarJava * 2 : 45000;
    }

    return [
      {
        id: "jne_reg",
        carrier: "JNE",
        service: "REG",
        title: "JNE Reguler",
        costMinor: baseReguler * weightKg,
        estimatedDays: isJabodetabek ? "1-2 days" : isJava ? "2-3 days" : "3-5 days",
      },
      {
        id: "jne_yes",
        carrier: "JNE",
        service: "YES",
        title: "JNE YES (Yakin Esok Sampai)",
        costMinor: baseExpress * weightKg,
        estimatedDays: isJabodetabek ? "1 day" : "1-2 days",
      },
      {
        id: "sicepat_best",
        carrier: "SiCepat",
        service: "BEST",
        title: "SiCepat BEST",
        costMinor: (baseReguler + 3000) * weightKg,
        estimatedDays: isJabodetabek ? "1 day" : "1-2 days",
      },
    ];
  }
}

export const flatRateShippingProvider = new FlatRateShippingProvider();
