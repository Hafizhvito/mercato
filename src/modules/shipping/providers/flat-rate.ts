import type { CalculateShippingParams, ShippingProvider, ShippingRate } from "../types";

export class FlatRateShippingProvider implements ShippingProvider {
  name = "flat_rate";

  async calculateRates(params: CalculateShippingParams): Promise<ShippingRate[]> {
    // Base weight tier (every 1000g adds base increment)
    const weightKg = Math.max(1, Math.ceil(params.weightGrams / 1000));

    // Distance multiplier: check destination province
    const isJabodetabek =
      params.destination.province === "DKI Jakarta" ||
      params.destination.city.includes("Bogor") ||
      params.destination.city.includes("Depok") ||
      params.destination.city.includes("Tangerang") ||
      params.destination.city.includes("Bekasi");

    const baseReguler = isJabodetabek ? 10000 : 15000;
    const baseExpress = isJabodetabek ? 20000 : 30000;

    return [
      {
        id: "jne_reg",
        carrier: "JNE",
        service: "REG",
        title: "JNE Reguler",
        costMinor: baseReguler * weightKg,
        estimatedDays: isJabodetabek ? "1-2 days" : "2-3 days",
      },
      {
        id: "jne_yes",
        carrier: "JNE",
        service: "YES",
        title: "JNE YES (Yakin Esok Sampai)",
        costMinor: baseExpress * weightKg,
        estimatedDays: "1 day",
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
