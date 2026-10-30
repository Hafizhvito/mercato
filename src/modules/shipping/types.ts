export interface Address {
  recipientName: string;
  phone: string;
  street: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  title: string;
  costMinor: number;
  estimatedDays: string;
}

export interface CalculateShippingParams {
  storeId: string;
  destination: Address;
  weightGrams: number;
  subtotalMinor: number;
}

export interface ShippingProvider {
  name: string;
  calculateRates(params: CalculateShippingParams): Promise<ShippingRate[]>;
}
