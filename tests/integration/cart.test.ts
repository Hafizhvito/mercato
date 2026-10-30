import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { cartRepository } from "@/modules/cart/repository";
import { cartService } from "@/modules/cart/service";
import { catalogService } from "@/modules/catalog/service";

describe("Phase 3 Integration: Cart & Price Revalidation", () => {
  let storeId: string;
  let testUserId: string;
  let productId: string;
  let variantId: string;
  const initialPrice = 150_000;

  beforeAll(async () => {
    // 1. Provision Test Store
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Cart Test Store",
        slug: `cart-test-store-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeId = store?.id ?? "";

    // 2. Provision Test User
    testUserId = `cart-user-${Date.now()}`;
    await db.insert(schema.user).values({
      id: testUserId,
      name: "Cart Test User",
      email: `${testUserId}@mercato.local`,
      role: "customer",
    });

    // 3. Provision Test Product with Variant
    const product = await catalogService.createProductWithVariants(storeId, {
      name: "Cart Test Product",
      description: "Test description",
      status: "published",
      variants: [
        {
          sku: `SKU-CART-${Date.now()}`,
          title: "Standard Edition",
          price: initialPrice,
          stock: 20,
        },
      ],
    });

    productId = product.id;
    variantId = product.variants[0]?.id ?? "";
  });

  afterAll(async () => {
    try {
      if (storeId) {
        await db.delete(schema.stores).where(eq(schema.stores.id, storeId));
      }
      if (testUserId) {
        await db.delete(schema.user).where(eq(schema.user.id, testUserId));
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("creates guest cart and manages items and quantities", async () => {
    const guestToken = `guest-${crypto.randomUUID()}`;

    // Add item to guest cart
    const item = await cartService.addItem(storeId, {
      guestToken,
      productId,
      variantId,
      quantity: 2,
      unitPrice: initialPrice,
    });

    expect(item).toBeDefined();
    expect(item.quantity).toBe(2);

    // Fetch detailed cart
    let detailed = await cartService.getDetailedCart(storeId, { guestToken });
    expect(detailed.items.length).toBe(1);
    expect(detailed.subtotal).toBe(300_000);
    expect(detailed.totalQuantity).toBe(2);

    // Update quantity
    await cartService.updateItemQuantity(item.id, 5);
    detailed = await cartService.getDetailedCart(storeId, { guestToken });
    expect(detailed.items[0]?.quantity).toBe(5);
    expect(detailed.subtotal).toBe(750_000);

    // Remove item
    await cartService.removeItem(item.id);
    detailed = await cartService.getDetailedCart(storeId, { guestToken });
    expect(detailed.items.length).toBe(0);
  });

  it("re-validates prices on read when catalog price changes", async () => {
    const guestToken = `guest-reval-${crypto.randomUUID()}`;

    // Add item at original price
    const item = await cartService.addItem(storeId, {
      guestToken,
      productId,
      variantId,
      quantity: 1,
      unitPrice: initialPrice,
    });

    expect(item.unitPrice).toBe(150_000);

    // Simulate merchant price update in catalog
    const newCatalogPrice = 180_000;
    await db
      .update(schema.productVariants)
      .set({ price: newCatalogPrice })
      .where(eq(schema.productVariants.id, variantId));

    // Next cart read must automatically re-validate and detect price change
    const detailed = await cartService.getDetailedCart(storeId, { guestToken });
    expect(detailed.items[0]?.unitPrice).toBe(newCatalogPrice);
    expect(detailed.subtotal).toBe(180_000);
    expect(detailed.priceChanges.length).toBe(1);
    expect(detailed.priceChanges[0]?.oldPrice).toBe(initialPrice);
    expect(detailed.priceChanges[0]?.newPrice).toBe(newCatalogPrice);
  });

  it("removes unpublished or deleted products from cart on read", async () => {
    const guestToken = `guest-del-${crypto.randomUUID()}`;

    await cartService.addItem(storeId, {
      guestToken,
      productId,
      variantId,
      quantity: 1,
      unitPrice: initialPrice,
    });

    // Merchant unpublishes product
    await db
      .update(schema.products)
      .set({ status: "draft" })
      .where(eq(schema.products.id, productId));

    // Next cart read must remove unlisted product
    const detailed = await cartService.getDetailedCart(storeId, { guestToken });
    expect(detailed.items.length).toBe(0);
    expect(detailed.removedItems.length).toBe(1);
    expect(detailed.removedItems[0]?.reason).toMatch(/no longer available/);

    // Restore to published
    await db
      .update(schema.products)
      .set({ status: "published" })
      .where(eq(schema.products.id, productId));
  });

  it("merges guest cart items into customer cart upon login", async () => {
    const guestToken = `guest-merge-${crypto.randomUUID()}`;

    // Guest adds item
    await cartService.addItem(storeId, {
      guestToken,
      productId,
      variantId,
      quantity: 3,
      unitPrice: initialPrice,
    });

    // Merge into user account
    const userCart = await cartService.mergeOnLogin(storeId, guestToken, testUserId);
    expect(userCart.userId).toBe(testUserId);

    // Read user cart
    const detailed = await cartService.getDetailedCart(storeId, { userId: testUserId });
    expect(detailed.items.length).toBe(1);
    expect(detailed.items[0]?.quantity).toBe(3);

    // Former guest cart must be cleaned up
    const guestCartAfter = await cartRepository.findCart(storeId, { guestToken });
    expect(guestCartAfter).toBeNull();
  });
});
