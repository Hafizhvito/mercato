import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogService } from "@/modules/catalog/service";
import { discountService } from "@/modules/discounts/service";
import { inventoryService } from "@/modules/inventory/service";
import type { ShippingAddress } from "@/modules/orders/schema";
import { orderService } from "@/modules/orders/service";

describe("Phase 3 Integration: Concurrency, Inventory Reservations, & Tenant Isolation", () => {
  let storeAId: string;
  let storeBId: string;
  let productAId: string;
  let singleStockVariantId: string;

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

    // 3. Provision Product in Store A with exactly 1 unit of stock
    const productA = await catalogService.createProductWithVariants(storeAId, {
      name: "Limited Edition Handcraft",
      description: "Only one piece available",
      status: "published",
      variants: [
        {
          sku: `SKU-LAST-UNIT-${Date.now()}`,
          title: "Unique Artifact",
          price: 500_000,
          stock: 1, // EXACTLY 1 UNIT
        },
      ],
    });

    productAId = productA.id;
    singleStockVariantId = productA.variants[0]?.id ?? "";

    // 4. Seed Discounts in Store A and Store B
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

  it("handles N concurrent checkouts for the last unit of stock: exactly 1 wins, 0 overselling, no negative stock", async () => {
    const CONCURRENT_ATTEMPTS = 5;

    // Dispatch 5 parallel checkout requests simultaneously for the same 1-unit variant
    const checkoutPromises = Array.from({ length: CONCURRENT_ATTEMPTS }, (_, index) => {
      const checkoutSessionId = `sess-race-${index}-${crypto.randomUUID()}`;
      const idempotencyKey = `idem-race-${index}-${crypto.randomUUID()}`;

      return orderService.createOrder({
        storeId: storeAId,
        idempotencyKey,
        checkoutSessionId,
        guestEmail: `buyer-${index}@mercato.local`,
        shippingAddress: mockAddress,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAmountMinor: 15_000,
        items: [
          {
            productId: productAId,
            variantId: singleStockVariantId,
            quantity: 1,
          },
        ],
      });
    });

    const results = await Promise.allSettled(checkoutPromises);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 checkout must succeed
    expect(fulfilled.length).toBe(1);
    // All other 4 checkouts must fail
    expect(rejected.length).toBe(CONCURRENT_ATTEMPTS - 1);

    // Verify rejection reason is insufficient stock
    for (const rej of rejected) {
      if (rej.status === "rejected") {
        expect(rej.reason.message).toMatch(/Insufficient stock/);
      }
    }

    // Verify available stock is now 0
    const availableStock = await inventoryService.getAvailableStock(singleStockVariantId);
    expect(availableStock).toBe(0);

    // Verify raw variant stock is never negative
    const [rawVariant] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, singleStockVariantId));
    expect(rawVariant?.stock).toBe(1); // Still 1, held by reservation

    // Winning order details
    const winningResult = (
      fulfilled[0] as PromiseFulfilledResult<{
        order: typeof schema.orders.$inferSelect;
      }>
    ).value;
    const winningOrder = winningResult.order;
    expect(winningOrder.status).toBe("awaiting_payment");
    expect(winningOrder.totalAmount).toBe(515_000); // 500.000 + 15.000

    // Transition winning order to "paid" -> commits reservation and decrements stock
    const paidOrder = await orderService.transitionOrderStatus(winningOrder.id, storeAId, "paid", {
      reason: "Payment verified",
      actorId: "system",
    });
    expect(paidOrder.status).toBe("paid");

    // After commit, variant stock is officially decremented to 0
    const [committedVariant] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, singleStockVariantId));
    expect(committedVariant?.stock).toBe(0);
  });

  it("releases reservation when an order is cancelled before payment", async () => {
    // Provision another 1-unit item to test reservation release
    const cancelProduct = await catalogService.createProductWithVariants(storeAId, {
      name: "Cancellable Item",
      description: "Test cancellation release",
      status: "published",
      variants: [
        {
          sku: `SKU-CANCEL-${Date.now()}`,
          title: "Cancel Variant",
          price: 100_000,
          stock: 1,
        },
      ],
    });

    const variantId = cancelProduct.variants[0]?.id ?? "";
    const checkoutSessionId = `sess-cancel-${crypto.randomUUID()}`;

    // Place order
    const { order } = await orderService.createOrder({
      storeId: storeAId,
      idempotencyKey: `idem-cancel-${crypto.randomUUID()}`,
      checkoutSessionId,
      guestEmail: "cancel-buyer@mercato.local",
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 15_000,
      items: [{ productId: cancelProduct.id, variantId, quantity: 1 }],
    });

    expect(order.status).toBe("awaiting_payment");
    expect(await inventoryService.getAvailableStock(variantId)).toBe(0);

    // Cancel order
    const cancelledOrder = await orderService.transitionOrderStatus(
      order.id,
      storeAId,
      "cancelled",
      { reason: "Customer cancelled checkout" },
    );
    expect(cancelledOrder.status).toBe("cancelled");

    // Stock reservation must be released and available stock restored to 1!
    expect(await inventoryService.getAvailableStock(variantId)).toBe(1);
  });

  it("enforces tenant boundary isolation across discounts and orders", async () => {
    // 1. Coupon isolation: Store A cannot validate Store B's coupon
    const couponFromB = await discountService.validateAndCalculate({
      storeId: storeAId,
      code: "STOREB20",
      subtotalMinor: 100_000,
    });
    expect(couponFromB.valid).toBe(false);
    expect(couponFromB.reason).toMatch(/does not exist/);

    // 2. Order isolation: Store B cannot read Store A's order
    const ordersA = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(eq(schema.orders.storeId, storeAId))
      .limit(1);

    if (ordersA[0]) {
      const foreignOrder = await orderService.getOrderById(ordersA[0].id, storeBId);
      expect(foreignOrder).toBeNull();

      // Store B cannot transition Store A's order
      await expect(
        orderService.transitionOrderStatus(ordersA[0].id, storeBId, "cancelled"),
      ).rejects.toThrow(/Order not found/);
    }
  });
});
