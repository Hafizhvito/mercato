import { getCitiesByProvince, getDistrictsByCity, getProvinces } from "./data/indonesia-regions";
import { flatRateShippingProvider } from "./providers/flat-rate";
import { rajaOngkirShippingProvider } from "./providers/rajaongkir";
import type { CalculateShippingParams, ShippingProvider, ShippingRate } from "./types";

export class ShippingService {
  private activeProvider: ShippingProvider;

  constructor() {
    this.activeProvider = process.env.RAJAONGKIR_API_KEY
      ? rajaOngkirShippingProvider
      : flatRateShippingProvider;
  }

  setProvider(provider: ShippingProvider) {
    this.activeProvider = provider;
  }

  async calculateRates(params: CalculateShippingParams): Promise<ShippingRate[]> {
    return this.activeProvider.calculateRates(params);
  }

  getProvinces() {
    return getProvinces();
  }

  getCities(provinceId: string) {
    return getCitiesByProvince(provinceId);
  }

  getDistricts(cityId: string) {
    return getDistrictsByCity(cityId);
  }
}

export const shippingService = new ShippingService();
