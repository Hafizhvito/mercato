import { describe, expect, it } from "vitest";
import type { Discount } from "@/modules/discounts/schema";
import { DiscountService } from "@/modules/discounts/service";

describe("Discount Engine Unit Tests", () => {
  const service = new DiscountService();

  function createMockDiscount(overrides: Partial<Discount>): Discount {
    return {
      id: "disc-1",
      storeId: "store-1",
      code: "PROMO",
      type: "percentage",
      value: 10,
      minSpend: 0,
      maxDiscount: null,
      startsAt: new Date(Date.now() - 3600_000),
      expiresAt: new Date(Date.now() + 3600_000),
      usageLimit: null,
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("calculates percentage discount accurately without cap", async () => {
    const mock = createMockDiscount({ type: "percentage", value: 15 });
    service.getDiscountByCode = async () => mock;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 200_000,
    });

    expect(res.valid).toBe(true);
    expect(res.discountAmountMinor).toBe(30_000); // 15% of 200.000
  });

  it("enforces maximum discount cap for percentage discounts", async () => {
    const mock = createMockDiscount({
      type: "percentage",
      value: 50,
      maxDiscount: 25_000,
    });
    service.getDiscountByCode = async () => mock;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 200_000,
    });

    expect(res.valid).toBe(true);
    // 50% of 200.000 is 100.000, but cap is 25.000
    expect(res.discountAmountMinor).toBe(25_000);
  });

  it("calculates fixed discount amount capped at subtotal", async () => {
    const mock = createMockDiscount({ type: "fixed", value: 50_000 });
    service.getDiscountByCode = async () => mock;

    // Subtotal exceeds discount
    const res1 = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 100_000,
    });
    expect(res1.discountAmountMinor).toBe(50_000);

    // Subtotal smaller than discount: discount capped at subtotal
    const res2 = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 30_000,
    });
    expect(res2.discountAmountMinor).toBe(30_000);
  });

  it("calculates free shipping discount matching shipping cost", async () => {
    const mock = createMockDiscount({ type: "free_shipping", value: 0 });
    service.getDiscountByCode = async () => mock;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 100_000,
      shippingAmountMinor: 15_000,
    });

    expect(res.valid).toBe(true);
    expect(res.discountAmountMinor).toBe(15_000);
  });

  it("rejects coupon if subtotal is below minimum spend requirement", async () => {
    const mock = createMockDiscount({ minSpend: 150_000 });
    service.getDiscountByCode = async () => mock;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 120_000,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/Minimum spend/);
  });

  it("rejects inactive, not yet started, or expired coupons", async () => {
    // Inactive
    service.getDiscountByCode = async () => createMockDiscount({ isActive: false });
    const res1 = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 100_000,
    });
    expect(res1.valid).toBe(false);

    // Future start
    service.getDiscountByCode = async () =>
      createMockDiscount({ startsAt: new Date(Date.now() + 86400_000) });
    const res2 = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 100_000,
    });
    expect(res2.valid).toBe(false);

    // Past expiry
    service.getDiscountByCode = async () =>
      createMockDiscount({ expiresAt: new Date(Date.now() - 86400_000) });
    const res3 = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 100_000,
    });
    expect(res3.valid).toBe(false);
  });

  it("rejects coupon when usage limit has been reached", async () => {
    const mock = createMockDiscount({ usageLimit: 5, usageCount: 5 });
    service.getDiscountByCode = async () => mock;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "PROMO",
      subtotalMinor: 100_000,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/usage limit/);
  });

  it("evaluates HEMAT10 demo code accurately", async () => {
    const mockHemat10 = createMockDiscount({
      code: "HEMAT10",
      type: "percentage",
      value: 10,
      minSpend: 50_000,
      maxDiscount: 50_000,
    });
    service.getDiscountByCode = async () => mockHemat10;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "HEMAT10",
      subtotalMinor: 150_000,
    });

    expect(res.valid).toBe(true);
    expect(res.discountAmountMinor).toBe(15_000); // 10% of 150.000
  });

  it("provides clear error message when coupon code is unknown or not found", async () => {
    service.getDiscountByCode = async () => null;

    const res = await service.validateAndCalculate({
      storeId: "store-1",
      code: "UNKNOWN_CODE",
      subtotalMinor: 100_000,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toBe("Coupon code does not exist");
  });
});
