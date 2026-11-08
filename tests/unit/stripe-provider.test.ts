import { describe, expect, it, vi } from "vitest";
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

describe("Stripe Line Items Builder: Tax Exclusive and Inclusive Modes", () => {
  it("builds line items for tax exclusive mode with discount and shipping asserting sum equals order total", async () => {
    // Order: subtotal $100.00 (10000 cents), discount $10.00 (1000 cents), shipping $15.00 (1500 cents), tax $9.90 (990 cents) -> total $114.90 (11490 cents)
    const mockOrder: any = {
      id: "ord-stripe-1",
      orderNumber: "ORD-STRIPE-EXC",
      storeId: "store-1",
      currency: "USD",
      subtotal: 10000,
      discountAmount: 1000,
      shippingAmount: 1500,
      taxAmount: 990,
      totalAmount: 11490,
      shippingCarrier: "DHL",
      shippingService: "EXPRESS",
      guestAccessToken: "tok-1",
    };

    const mockItems: any[] = [
      {
        id: "item-1",
        productId: "prod-1",
        variantId: "var-1",
        productName: "T-Shirt",
        variantTitle: "Size L",
        unitPrice: 10000,
        quantity: 1,
      },
    ];

    let capturedParams: any = null;
    process.env.STRIPE_SECRET_KEY = "mock-stripe-secret-test-key";
    const availSpy = vi.spyOn(stripePaymentProvider, "isAvailable").mockReturnValue(true);
    (stripePaymentProvider as any).stripeClient = {
      checkout: {
        sessions: {
          create: async (params: any) => {
            capturedParams = params;
            return {
              id: "cs_test_123",
              url: "https://checkout.stripe.com/c/pay/cs_test_123",
              expires_at: Math.floor(Date.now() / 1000) + 900,
            };
          },
        },
      },
    };

    const session = await stripePaymentProvider.createPaymentSession(mockOrder, mockItems);
    expect(session.providerSessionId).toBe("cs_test_123");
    availSpy.mockRestore();

    const lineItems = capturedParams.line_items;
    const totalLineItemsSum = lineItems.reduce(
      (sum: number, it: any) => sum + it.price_data.unit_amount * it.quantity,
      0,
    );
    expect(totalLineItemsSum).toBe(mockOrder.totalAmount);

    // Verify tax line item exists with 990 cents
    expect(
      lineItems.some(
        (it: any) => it.price_data.product_data.name === "Tax" && it.price_data.unit_amount === 990,
      ),
    ).toBe(true);
    // Verify discount line item exists with -1000 cents
    expect(
      lineItems.some(
        (it: any) =>
          it.price_data.product_data.name === "Promotional Discount" &&
          it.price_data.unit_amount === -1000,
      ),
    ).toBe(true);
    // Verify shipping line item exists with 1500 cents
    expect(
      lineItems.some(
        (it: any) =>
          it.price_data.product_data.name.startsWith("Shipping") &&
          it.price_data.unit_amount === 1500,
      ),
    ).toBe(true);
  });

  it("builds line items for tax inclusive mode with discount and shipping asserting sum equals order total and no tax line item", async () => {
    // Order: subtotal $100.00 (10000 cents), discount $10.00 (1000 cents), shipping $15.00 (1500 cents), total $105.00 (10500 cents)
    const mockOrder: any = {
      id: "ord-stripe-2",
      orderNumber: "ORD-STRIPE-INC",
      storeId: "store-1",
      currency: "USD",
      subtotal: 10000,
      discountAmount: 1000,
      shippingAmount: 1500,
      taxAmount: 891, // included inside subtotal
      totalAmount: 10500,
      shippingCarrier: "DHL",
      shippingService: "STANDARD",
      guestAccessToken: "tok-2",
    };

    const mockItems: any[] = [
      {
        id: "item-2",
        productId: "prod-2",
        variantId: "var-2",
        productName: "Hoodie",
        variantTitle: "Black M",
        unitPrice: 10000,
        quantity: 1,
      },
    ];

    let capturedParams: any = null;
    process.env.STRIPE_SECRET_KEY = "mock-stripe-secret-test-key";
    const availSpy = vi.spyOn(stripePaymentProvider, "isAvailable").mockReturnValue(true);
    (stripePaymentProvider as any).stripeClient = {
      checkout: {
        sessions: {
          create: async (params: any) => {
            capturedParams = params;
            return {
              id: "cs_test_456",
              url: "https://checkout.stripe.com/c/pay/cs_test_456",
              expires_at: Math.floor(Date.now() / 1000) + 900,
            };
          },
        },
      },
    };

    const session = await stripePaymentProvider.createPaymentSession(mockOrder, mockItems);
    expect(session.providerSessionId).toBe("cs_test_456");
    availSpy.mockRestore();

    const lineItems = capturedParams.line_items;
    const totalLineItemsSum = lineItems.reduce(
      (sum: number, it: any) => sum + it.price_data.unit_amount * it.quantity,
      0,
    );
    expect(totalLineItemsSum).toBe(mockOrder.totalAmount);

    // Verify NO tax line item was appended
    expect(lineItems.some((it: any) => it.price_data.product_data.name === "Tax")).toBe(false);
  });
});
