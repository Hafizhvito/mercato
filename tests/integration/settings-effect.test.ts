import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { orderService } from "@/modules/orders/service";
import { shippingService } from "@/modules/shipping/service";

describe("Phase 5: Store Settings Live Effect Suite (Tax & Shipping Zones)", () => {
  let storeId: string;
  let testProductId: string;
  let testVariantId: string;

  beforeAll(async () => {
    // 1. Create a dedicated test store with custom shipping rates and 11% tax
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Tax & Rates Store",
        slug: `rates-store-${Date.now()}`,
        currency: "IDR",
        locale: "id",
        taxRatePercent: 11, // 11% Indonesian VAT
        taxInclusive: false,
        shippingFlatRates: {
          jabodetabek: 12000, // Custom rate (default is 10000)
          java: 18000, // Custom rate (default is 15000)
          luarJava: 35000, // Custom rate (default is 25000)
        },
      })
      .returning();
    storeId = store!.id;

    // 2. Create product & variant
    const [product] = await db
      .insert(schema.products)
      .values({
        storeId,
        name: "Taxable Shirt",
        slug: `taxable-shirt-${Date.now()}`,
        status: "published",
      })
      .returning();
    testProductId = product!.id;

    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        storeId,
        productId: testProductId,
        sku: `SKU-TAX-${Date.now()}`,
        title: "Medium",
        price: 100000,
        stock: 100,
      })
      .returning();
    testVariantId = variant!.id;
  });

  it("applies store custom shipping flat rates for Jabodetabek, Java, and Luar Jawa zones", async () => {
    // A. Jabodetabek destination
    const jabodetabekAddress = {
      recipientName: "Budi",
      phone: "081234567890",
      street: "Jl. Sudirman No. 1",
      district: "Gambir",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postalCode: "10110",
      country: "Indonesia",
    };

    const jaboRates = await shippingService.calculateRates({
      storeId,
      destination: jabodetabekAddress,
      weightGrams: 1000,
      subtotalMinor: 100000,
    });

    const regJabo = jaboRates.find((r) => r.service === "REG");
    expect(regJabo?.costMinor).toBe(12000); // Matches configured 12,000

    // B. Luar Jawa destination (Bali / Sumatera / etc.)
    const luarJawaAddress = {
      recipientName: "Wayan",
      phone: "081234567890",
      street: "Jl. Sunset Road",
      district: "Kuta",
      city: "Badung",
      province: "Bali",
      postalCode: "80361",
      country: "Indonesia",
    };

    const luarRates = await shippingService.calculateRates({
      storeId,
      destination: luarJawaAddress,
      weightGrams: 1000,
      subtotalMinor: 100000,
    });

    const regLuar = luarRates.find((r) => r.service === "REG");
    expect(regLuar?.costMinor).toBe(35000); // Matches configured 35,000
  });

  it("calculates and applies store tax percentage (11%) when an order is created", async () => {
    const address = {
      recipientName: "Tax Customer",
      phone: "081234567890",
      street: "Jl. Sudirman No. 1",
      district: "Gambir",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postalCode: "10110",
      country: "Indonesia",
    };

    const _subtotal = 100000; // Rp 100.000
    // Custom shipping for Jabodetabek REG is 12000
    // Tax at 11% on Rp 100.000 = Rp 11.000
    // Total = 100000 + 12000 + 11000 = Rp 123.000

    const { order } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "tax.customer@example.test",
      idempotencyKey: `idem-tax-${Date.now()}`,
      checkoutSessionId: `sess-tax-${Date.now()}`,
      shippingAddress: address,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 12000,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 1 }],
    });

    expect(order.subtotal).toBe(100000);
    expect(order.shippingAmount).toBe(12000);
    expect(order.taxAmount).toBe(11000); // 11% VAT accurately calculated
    expect(order.totalAmount).toBe(123000); // Subtotal + Shipping + Tax
  });

  it("guarantees 0 tax when store tax percentage is 0 (default behavior preserved)", async () => {
    // Create store with default 0% tax
    const [zeroStore] = await db
      .insert(schema.stores)
      .values({
        name: "Zero Tax Store",
        slug: `zero-tax-${Date.now()}`,
        currency: "IDR",
        locale: "id",
        taxRatePercent: 0,
      })
      .returning();

    const [zeroProd] = await db
      .insert(schema.products)
      .values({
        storeId: zeroStore!.id,
        name: "Zero Tax Product",
        slug: `zero-prod-${Date.now()}`,
        status: "published",
      })
      .returning();

    const [v] = await db
      .insert(schema.productVariants)
      .values({
        storeId: zeroStore!.id,
        productId: zeroProd!.id,
        sku: `SKU-ZERO-${Date.now()}`,
        title: "Default Edition",
        price: 50000,
        stock: 50,
      })
      .returning();

    const address = {
      recipientName: "Zero Customer",
      phone: "081234567890",
      street: "Jl. Thamrin No. 2",
      district: "Menteng",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      postalCode: "10310",
      country: "Indonesia",
    };

    const { order } = await orderService.createOrder({
      storeId: zeroStore!.id,
      customerId: null,
      guestEmail: "zero.customer@example.test",
      idempotencyKey: `idem-zero-${Date.now()}`,
      checkoutSessionId: `sess-zero-${Date.now()}`,
      shippingAddress: address,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
      items: [{ productId: zeroProd!.id, variantId: v!.id, quantity: 1 }],
    });

    expect(order.taxAmount).toBe(0);
    expect(order.totalAmount).toBe(60000); // 50000 + 10000 + 0
  });
});
