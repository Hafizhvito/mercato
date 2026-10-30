import { cartRepository } from "./repository";
import type { Cart } from "./schema";

export const MAX_CART_ITEM_QUANTITY = 10;

export interface DetailedCartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantTitle: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableStock: number;
}

export interface DetailedCart {
  id: string;
  storeId: string;
  userId?: string | null;
  guestToken?: string | null;
  currency: string;
  items: DetailedCartItem[];
  subtotal: number;
  totalQuantity: number;
  priceChanges: { name: string; oldPrice: number; newPrice: number }[];
  removedItems: { name: string; reason: string }[];
  cappedItems: {
    name: string;
    requestedQuantity: number;
    cappedQuantity: number;
    reason: "MAX_ORDER_LIMIT" | "INSUFFICIENT_STOCK";
  }[];
}

export class CartService {
  async getOrCreateCart(
    storeId: string,
    params: { guestToken?: string; userId?: string },
  ): Promise<Cart> {
    const existing = await cartRepository.findCart(storeId, params);
    if (existing) return existing;

    return cartRepository.createCart({
      storeId,
      guestToken: params.guestToken,
      userId: params.userId,
    });
  }

  async getDetailedCart(
    storeId: string,
    params: { guestToken?: string; userId?: string },
  ): Promise<DetailedCart> {
    const cart = await this.getOrCreateCart(storeId, params);
    const rawItems = await cartRepository.getCartItems(cart.id);

    const items: DetailedCartItem[] = [];
    const priceChanges: { name: string; oldPrice: number; newPrice: number }[] = [];
    const removedItems: { name: string; reason: string }[] = [];
    const cappedItems: {
      name: string;
      requestedQuantity: number;
      cappedQuantity: number;
      reason: "MAX_ORDER_LIMIT" | "INSUFFICIENT_STOCK";
    }[] = [];

    let subtotal = 0;
    let totalQuantity = 0;

    for (const row of rawItems) {
      // 1. Verify product and variant availability (published and not deleted)
      if (
        !row.product ||
        !row.variant ||
        row.product.status !== "published" ||
        row.product.deletedAt !== null ||
        row.variant.deletedAt !== null
      ) {
        await cartRepository.deleteItem(row.id);
        removedItems.push({
          name: row.product?.name ?? "Unavailable Product",
          reason: "Product is no longer available",
        });
        continue;
      }

      const currentPrice = row.variant.price;
      let effectivePrice = row.unitPrice;

      // 2. Price re-validation: detect if price changed in catalog
      if (row.unitPrice !== currentPrice) {
        priceChanges.push({
          name: `${row.product.name} (${row.variant.title})`,
          oldPrice: row.unitPrice,
          newPrice: currentPrice,
        });
        effectivePrice = currentPrice;
        await cartRepository.updateItemQuantity(row.id, row.quantity);
      }

      // 3. Enforce maximum quantity (capped at MAX_CART_ITEM_QUANTITY or current stock)
      const stock = Math.max(0, row.variant.stock);
      let safeQuantity = row.quantity;
      let capReason: "MAX_ORDER_LIMIT" | "INSUFFICIENT_STOCK" | null = null;

      if (safeQuantity > MAX_CART_ITEM_QUANTITY) {
        safeQuantity = MAX_CART_ITEM_QUANTITY;
        capReason = "MAX_ORDER_LIMIT";
      }

      if (safeQuantity > stock) {
        safeQuantity = Math.max(1, stock);
        capReason = "INSUFFICIENT_STOCK";
      }

      if (safeQuantity !== row.quantity) {
        await cartRepository.updateItemQuantity(row.id, safeQuantity);
        if (capReason) {
          cappedItems.push({
            name: `${row.product.name} (${row.variant.title})`,
            requestedQuantity: row.quantity,
            cappedQuantity: safeQuantity,
            reason: capReason,
          });
        }
      }

      const lineTotal = effectivePrice * safeQuantity;
      subtotal += lineTotal;
      totalQuantity += safeQuantity;

      items.push({
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        name: row.product.name,
        variantTitle: row.variant.title,
        sku: row.variant.sku,
        imageUrl: row.image?.url,
        unitPrice: effectivePrice,
        quantity: safeQuantity,
        lineTotal,
        availableStock: stock,
      });
    }

    return {
      id: cart.id,
      storeId: cart.storeId,
      userId: cart.userId,
      guestToken: cart.guestToken,
      currency: cart.currency,
      items,
      subtotal,
      totalQuantity,
      priceChanges,
      removedItems,
      cappedItems,
    };
  }

  async addItem(
    storeId: string,
    params: {
      guestToken?: string;
      userId?: string;
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
    },
  ) {
    const cart = await this.getOrCreateCart(storeId, {
      guestToken: params.guestToken,
      userId: params.userId,
    });

    const quantityToAdd = Math.max(1, Math.min(10, params.quantity));
    return cartRepository.addItem({
      cartId: cart.id,
      productId: params.productId,
      variantId: params.variantId,
      quantity: quantityToAdd,
      unitPrice: params.unitPrice,
    });
  }

  async updateItemQuantity(cartItemId: string, quantity: number) {
    const safeQty = Math.max(0, Math.min(10, quantity));
    return cartRepository.updateItemQuantity(cartItemId, safeQty);
  }

  async removeItem(cartItemId: string) {
    return cartRepository.deleteItem(cartItemId);
  }

  async clearCart(cartId: string) {
    return cartRepository.clearCart(cartId);
  }

  async mergeOnLogin(storeId: string, guestToken: string, userId: string) {
    return cartRepository.mergeGuestCart(storeId, guestToken, userId);
  }
}

export const cartService = new CartService();
