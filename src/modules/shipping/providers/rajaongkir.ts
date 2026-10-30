import { logger } from "@/lib/logger";
import type { CalculateShippingParams, ShippingProvider, ShippingRate } from "../types";
import { flatRateShippingProvider } from "./flat-rate";

export class RajaOngkirShippingProvider implements ShippingProvider {
  name = "rajaongkir";
  private apiKey?: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.RAJAONGKIR_API_KEY;
    this.baseUrl =
      options?.baseUrl || process.env.RAJAONGKIR_BASE_URL || "https://api.rajaongkir.com/starter";
  }

  async calculateRates(params: CalculateShippingParams): Promise<ShippingRate[]> {
    if (!this.apiKey) {
      // Gracefully fall back to standard flat rate when API key is not configured
      return flatRateShippingProvider.calculateRates(params);
    }

    try {
      // Attempt live RajaOngkir query
      const response = await fetch(`${this.baseUrl}/cost`, {
        method: "POST",
        headers: {
          key: this.apiKey,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          origin: "501", // Default origin city (e.g. Jakarta Barat)
          destination: params.destination.postalCode || "10110",
          weight: Math.max(1, params.weightGrams).toString(),
          courier: "jne",
        }),
      });

      if (!response.ok) {
        throw new Error(`RajaOngkir responded with status ${response.status}`);
      }

      const data = (await response.json()) as {
        rajaongkir?: {
          results?: {
            code: string;
            name: string;
            costs: {
              service: string;
              description: string;
              cost: { value: number; etd: string }[];
            }[];
          }[];
        };
      };

      const results = data.rajaongkir?.results?.[0];
      if (!results?.costs || results.costs.length === 0) {
        return flatRateShippingProvider.calculateRates(params);
      }

      return results.costs.map((c) => {
        const costItem = c.cost[0];
        const costValue = costItem?.value ?? 15000;
        return {
          id: `rajaongkir_${results.code}_${c.service.toLowerCase()}`,
          carrier: results.name,
          service: c.service,
          title: `${results.name} - ${c.description}`,
          costMinor: costValue,
          estimatedDays: costItem?.etd ? `${costItem.etd} days` : "2-3 days",
        };
      });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "RajaOngkir request failed, falling back to flat rate shipping",
      );
      return flatRateShippingProvider.calculateRates(params);
    }
  }
}

export const rajaOngkirShippingProvider = new RajaOngkirShippingProvider();
