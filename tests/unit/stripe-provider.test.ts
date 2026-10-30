import { describe, expect, it } from "vitest";
import { stripePaymentProvider } from "@/modules/payments/providers/stripe";

/**
 * Verification against official Stripe documentation:
 * URL: https://docs.stripe.com/currencies
 *
 * Official Stripe Statement:
 * 1. "All API requests expect amounts to be provided in a currency’s smallest unit."
 * 2. Zero-decimal currencies list: BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, UGX, VND, VUV, XAF, XOF, XPF.
 *    -> IDR is NOT in the zero-decimal list.
 * 3. Non-card payment methods support up to 12 digits for IDR:
 *    "for example, a value of 999999999999 for 9,999,999,999.99 IDR".
 * 4. Minimum charge: "0.50 IDR" (i.e. integer value 50 in API).
 */
describe("Item 4 Unit: Stripe IDR Minor Units Verification against Official Docs", () => {
  it("converts Mercato IDR integer amounts to Stripe 2-decimal minor units (* 100)", () => {
    // Rp 150.000 in Mercato is 150000 -> Stripe API expects 15000000 (15,000,000 cents/sen)
    expect(stripePaymentProvider.toStripeAmount(150_000, "IDR")).toBe(15_000_000);

    // Rp 1.000 in Mercato is 1000 -> Stripe API expects 100000
    expect(stripePaymentProvider.toStripeAmount(1_000, "IDR")).toBe(100_000);

    // Minimum charge: Rp 500 in Mercato is 500 -> Stripe API expects 50000
    expect(stripePaymentProvider.toStripeAmount(500, "IDR")).toBe(50_000);
  });

  it("converts Stripe IDR amounts back to Mercato whole integer units (/ 100)", () => {
    expect(stripePaymentProvider.fromStripeAmount(15_000_000, "IDR")).toBe(150_000);
    expect(stripePaymentProvider.fromStripeAmount(100_000, "IDR")).toBe(1_000);
    expect(stripePaymentProvider.fromStripeAmount(50_000, "IDR")).toBe(500);
  });

  it("leaves standard currencies like USD and SGD intact without double multiplying", () => {
    // $10.00 USD is already represented as 1000 cents in Mercato
    expect(stripePaymentProvider.toStripeAmount(1000, "USD")).toBe(1000);
    expect(stripePaymentProvider.fromStripeAmount(1000, "USD")).toBe(1000);

    // S$25.50 SGD is already represented as 2550 cents in Mercato
    expect(stripePaymentProvider.toStripeAmount(2550, "SGD")).toBe(2550);
    expect(stripePaymentProvider.fromStripeAmount(2550, "SGD")).toBe(2550);
  });
});
