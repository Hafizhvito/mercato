import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogService } from "@/modules/catalog/service";
import { discountService } from "@/modules/discounts/service";
import { inventoryService } from "@/modules/inventory/service";
import type { ShippingAddress } from "@/modules/orders/schema";
import { orderService } from "@/modules/orders/service";

describe("Phase 4 Strengthened Concurrency, Reservations, & Integrity Suite", () => {
  let storeAId: string;
  let storeBId: string;
  let singleStockVariantId: string;
  let fiveStockVariantId: string;
  let singleStockProductId: string;
  let fiveStockProductId: string;

  const mockAddress: ShippingAddress = {
    recipientName: "Test Buyer",
    phone: "081234567890",
    street: "Jl. Sudirman No. 1",
    district: "Gambir",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    postalCode: "10110",
    country: "Indonesia",
  };

  beforeAll(async () => {
    // 1. Provision Store A
    const [storeA] = await db
      .insert(schema.stores)
      .values({
        name: "Store A Concurrency",
        slug: `store-a-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeAId = storeA?.id ?? "";

    // 2. Provision Store B (for tenant isolation test)
    const [storeB] = await db
      .insert(schema.stores)
      .values({
        name: "Store B Isolation",
        slug: `store-b-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeBId = storeB?.id ?? "";

    // 3. Provision Product with 1 unit of stock
    const product1 = await catalogService.createProductWithVariants(storeAId, {
      name: "Limited Edition Handcraft",
      description: "Only one piece available",
      status: "published",
      variants: [
        {
          sku: `SKU-ONE-${Date.now()}`,
          title: "Unique Artifact",
          price: 500_000,
          stock: 1, // EXACTLY 1 UNIT
        },
      ],
    });
    singleStockProductId = product1.id;
    singleStockVariantId = product1.variants[0]?.id ?? "";

    // 4. Provision Product with 5 units of stock
    const product5 = await catalogService.createProductWithVariants(storeAId, {
      name: "Artisan Batch Coffee",
      description: "Batch of five packets",
      status: "published",
      variants: [
        {
          sku: `SKU-FIVE-${Date.now()}`,
          title: "250g Beans",
          price: 120_000,
          stock: 5, // EXACTLY 5 UNITS
        },
      ],
    });
    fiveStockProductId = product5.id;
    fiveStockVariantId = product5.variants[0]?.id ?? "";

    // 5. Seed Discounts in Store A and Store B
    await db.insert(schema.discounts).values([
      {
        storeId: storeAId,
        code: "STOREA10",
        type: "percentage",
        value: 10,
        startsAt: new Date(Date.now() - 3600_000),
      },
      {
        storeId: storeBId,
        code: "STOREB20",
        type: "percentage",
        value: 20,
        startsAt: new Date(Date.now() - 3600_000),
      },
    ]);
  });

  afterAll(async () => {
    try {
      if (storeAId) {
        await db.delete(schema.stores).where(eq(schema.stores.id, storeAId));
      }
      if (storeBId) {
        await db.delete(schema.stores).where(eq(schema.stores.id, storeBId));
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("handles 20 concurrent checkouts for 1 unit: exactly 1 wins, 19 fail, 0 overselling", async () => {
    const CONCURRENT_ATTEMPTS = 20;

    const checkoutPromises = Array.from({ length: CONCURRENT_ATTEMPTS }, (_, index) => {
      const checkoutSessionId = `sess-race1-${index}-${crypto.randomUUID()}`;
      const idempotencyKey = `idem-race1-${index}-${crypto.randomUUID()}`;

      return orderService
        .createOrder({
          storeId: storeAId,
          idempotencyKey,
          checkoutSessionId,
          guestEmail: `buyer-${index}@example.com`,
          shippingAddress: mockAddress,
          shippingCarrier: "JNE",
          shippingService: "REG",
          shippingAmountMinor: 18_000,
          items: [
            {
              productId: singleStockProductId,
              variantId: singleStockVariantId,
              quantity: 1,
            },
          ],
        })
        .then((res) => ({ success: true, order: res.order }))
        .catch((err) => ({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }));
    });

    const results = await Promise.all(checkoutPromises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r): r is { success: false; error: string } => !r.success);

    // EXACTLY 1 checkout must succeed out of 20
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(19);

    for (const fail of failures) {
      expect(fail.error).toMatch(/Insufficient stock/i);
    }

    // Verify database state: Available stock must be 0
    const availableStock = await inventoryService.getAvailableStock(singleStockVariantId);
    expect(availableStock).toBe(0);
  });

  it("handles 20 parallel buyers of quantity 1 against stock of 5: exactly 5 succeed, 15 fail", async () => {
    const CONCURRENT_ATTEMPTS = 20;

    const checkoutPromises = Array.from({ length: CONCURRENT_ATTEMPTS }, (_, index) => {
      const checkoutSessionId = `sess-race5-${index}-${crypto.randomUUID()}`;
      const idempotencyKey = `idem-race5-${index}-${crypto.randomUUID()}`;

      return orderService
        .createOrder({
          storeId: storeAId,
          idempotencyKey,
          checkoutSessionId,
          guestEmail: `buyer5-${index}@example.com`,
          shippingAddress: mockAddress,
          shippingCarrier: "JNE",
          shippingService: "REG",
          shippingAmountMinor: 18_000,
          items: [
            {
              productId: fiveStockProductId,
              variantId: fiveStockVariantId,
              quantity: 1,
            },
          ],
        })
        .then((res) => ({ success: true, order: res.order }))
        .catch((err) => ({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }));
    });

    const results = await Promise.all(checkoutPromises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r): r is { success: false; error: string } => !r.success);

    // EXACTLY 5 checkouts must succeed out of 20
    expect(successes.length).toBe(5);
    expect(failures.length).toBe(15);

    // Available stock must be exactly 0 (no negative stock, no overselling)
    const availableStock = await inventoryService.getAvailableStock(fiveStockVariantId);
    expect(availableStock).toBe(0);
  });

  it("releases reservation when expired and restores available stock", async () => {
    const timestamp = Date.now();
    const product = await catalogService.createProductWithVariants(storeAId, {
      name: `Expiring Stock Item ${timestamp}`,
      status: "published",
      variants: [
        {
          sku: `SKU-EXP-${timestamp}`,
          title: "Expiry Test",
          price: 200_000,
          stock: 3,
        },
      ],
    });
    const variantId = product.variants[0]!.id;

    // Reserve 2 units
    const checkoutSessionId = `sess-exp-${timestamp}`;
    const reservationResult = await inventoryService.reserveStock({
      storeId: storeAId,
      checkoutSessionId,
      items: [{ variantId, quantity: 2 }],
    });
    expect(reservationResult.success).toBe(true);
    expect(await inventoryService.getAvailableStock(variantId)).toBe(1);

    // Simulate expiration by backdating reservedUntil to the past
    await db
      .update(schema.stockReservations)
      .set({
        reservedUntil: new Date(Date.now() - 60_000), // 1 minute in the past
      })
      .where(eq(schema.stockReservations.checkoutSessionId, checkoutSessionId));

    // Run sweeper
    const { sweptCount } = await inventoryService.sweepExpiredReservations();
    expect(sweptCount).toBeGreaterThanOrEqual(1);

    // Available stock must be fully restored to 3!
    expect(await inventoryService.getAvailableStock(variantId)).toBe(3);
  });

  it("executes idempotent double-commit without double-decrementing stock", async () => {
    const timestamp = Date.now();
    const product = await catalogService.createProductWithVariants(storeAId, {
      name: `Double Commit Test ${timestamp}`,
      status: "published",
      variants: [
        {
          sku: `SKU-DC-${timestamp}`,
          title: "Double Commit",
          price: 100_000,
          stock: 10,
        },
      ],
    });
    const variantId = product.variants[0]!.id;
    const checkoutSessionId = `sess-dc-${timestamp}`;

    // Reserve 4 units
    await inventoryService.reserveStock({
      storeId: storeAId,
      checkoutSessionId,
      items: [{ variantId, quantity: 4 }],
    });

    const [variantBeforeCommit] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));
    expect(variantBeforeCommit?.stock).toBe(10); // Physical stock intact before payment commit

    // Commit #1
    const dummyOrderId = crypto.randomUUID();
    const committedCount1 = await inventoryService.commitReservations(
      checkoutSessionId,
      dummyOrderId,
    );
    expect(committedCount1).toBe(1);

    const [variantAfterCommit1] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));
    expect(variantAfterCommit1?.stock).toBe(6); // 10 - 4 = 6

    // Commit #2 (idempotent double commit)
    const committedCount2 = await inventoryService.commitReservations(
      checkoutSessionId,
      dummyOrderId,
    );
    expect(committedCount2).toBe(0); // Safe no-op

    const [variantAfterCommit2] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));
    expect(variantAfterCommit2?.stock).toBe(6); // Stock remains 6, not decremented twice!
  });

  it("server recomputes shipping rate from carrier/service, rejecting client price tampering", async () => {
    const timestamp = Date.now();
    const product = await catalogService.createProductWithVariants(storeAId, {
      name: `Shipping Integrity Product ${timestamp}`,
      status: "published",
      variants: [
        {
          sku: `SKU-SHIP-${timestamp}`,
          title: "Standard Item",
          price: 150_000,
          stock: 10,
        },
      ],
    });
    const variantId = product.variants[0]!.id;

    // Client maliciously attempts to send shippingAmountMinor: 1 (Rp 1)
    const orderResult = await orderService.createOrder({
      storeId: storeAId,
      idempotencyKey: `idem-ship-${timestamp}`,
      checkoutSessionId: `sess-ship-${timestamp}`,
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 1, // Tampered client price!
      items: [{ productId: product.id, variantId, quantity: 1 }],
    });

    // Server must have computed the real flat-rate price (Rp 10,000 for JNE REG in Jabodetabek)
    expect(orderResult.order.shippingAmount).toBe(10_000);
    expect(orderResult.order.shippingAmount).not.toBe(1);
    expect(orderResult.order.totalAmount).toBe(150_000 + 10_000);
  });
});
