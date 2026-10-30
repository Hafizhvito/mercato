import { describe, expect, it } from "vitest";
import { stripePaymentProvider } from "@/modules/payments/providers/stripe";

/**
 * Stripe Currency & IDR Refusal Test Suite:
 *
 * Official Stripe Documentation (https://docs.stripe.com/currencies):
 * 1. "All API requests expect amounts to be provided in a currency’s smallest unit."
 * 2. Zero-decimal list: BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, UGX, VND, VUV, XAF, XOF, XPF.
 *    (IDR is NOT in the zero-decimal list).
 * 3. Minimum amounts: "0.50 IDR" (alongside 0.50 USD, 0.50 EUR, 50 JPY, etc.)
 * 4. Maximum amounts for other payment methods: "12 digits for IDR, for a maximum charge of 9,999,999,999.99 IDR ( 999999999999 )"
 *
 * Requirement:
 * Stripe IDR processing is explicitly refused in code pending verification.
 */
describe("Item 1 Unit: Stripe IDR Refusal & Standard Currency Pass-Through", () => {
  it("explicitly refuses IDR in toStripeAmount and throws an informative error", () => {
    expect(() => stripePaymentProvider.toStripeAmount(150_000, "IDR")).toThrow(
      /IDR is refused in code until a Stripe account that supports IDR is verified/,
    );
  });

  it("explicitly refuses IDR in fromStripeAmount and throws an informative error", () => {
    expect(() => stripePaymentProvider.fromStripeAmount(15_000_000, "IDR")).toThrow(
      /IDR is refused in code until a Stripe account that supports IDR is verified/,
    );
  });

  it("leaves standard currencies like USD and SGD intact without double multiplying", () => {
    // $10.00 USD is already represented as 1000 cents in Mercato
    expect(stripePaymentProvider.toStripeAmount(1000, "USD")).toBe(1000);
    expect(stripePaymentProvider.fromStripeAmount(1000, "USD")).toBe(1000);

    // S$25.50 SGD is already represented as 2550 cents in Mercato
    expect(stripePaymentProvider.toStripeAmount(2550, "SGD")).toBe(2550);
    expect(stripePaymentProvider.fromStripeAmount(2550, "SGD")).toBe(2550);

    // €50.00 EUR is 5000 cents
    expect(stripePaymentProvider.toStripeAmount(5000, "EUR")).toBe(5000);
    expect(stripePaymentProvider.fromStripeAmount(5000, "EUR")).toBe(5000);
  });
});
