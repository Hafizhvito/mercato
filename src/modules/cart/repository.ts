import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { Cart, CartItem, NewCart } from "./schema";

export class CartRepository {
  async findCart(
    storeId: string,
    params: { guestToken?: string; userId?: string },
  ): Promise<Cart | null> {
    if (params.userId) {
      const [userCart] = await db
        .select()
        .from(schema.carts)
        .where(and(eq(schema.carts.storeId, storeId), eq(schema.carts.userId, params.userId)))
        .limit(1);
      if (userCart) return userCart;
    }

    if (params.guestToken) {
      const [guestCart] = await db
        .select()
        .from(schema.carts)
        .where(
          and(eq(schema.carts.storeId, storeId), eq(schema.carts.guestToken, params.guestToken)),
        )
        .limit(1);
      if (guestCart) return guestCart;
    }

    return null;
  }

  async createCart(data: NewCart): Promise<Cart> {
    const [cart] = await db.insert(schema.carts).values(data).returning();
    if (!cart) throw new Error("Failed to create cart");
    return cart;
  }

  async getCartItems(cartId: string): Promise<
    (CartItem & {
      product: typeof schema.products.$inferSelect | null;
      variant: typeof schema.productVariants.$inferSelect | null;
      image: typeof schema.productImages.$inferSelect | null;
    })[]
  > {
    const items = await db
      .select({
        item: schema.cartItems,
        product: schema.products,
        variant: schema.productVariants,
        image: schema.productImages,
      })
      .from(schema.cartItems)
      .leftJoin(
        schema.products,
        and(eq(schema.cartItems.productId, schema.products.id), isNull(schema.products.deletedAt)),
      )
      .leftJoin(
        schema.productVariants,
        and(
          eq(schema.cartItems.variantId, schema.productVariants.id),
          isNull(schema.productVariants.deletedAt),
        ),
      )
      .leftJoin(
        schema.productImages,
        and(
          eq(schema.cartItems.productId, schema.productImages.productId),
          eq(schema.productImages.position, 0),
        ),
      )
      .where(eq(schema.cartItems.cartId, cartId));

    return items.map((row) => ({
      ...row.item,
      product: row.product,
      variant: row.variant,
      image: row.image,
    }));
  }

  async addItem(data: {
    cartId: string;
    productId: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
  }): Promise<CartItem> {
    const [existing] = await db
      .select()
      .from(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.cartId, data.cartId),
          eq(schema.cartItems.variantId, data.variantId),
        ),
      )
      .limit(1);

    if (existing) {
      const newQuantity = existing.quantity + data.quantity;
      const [updated] = await db
        .update(schema.cartItems)
        .set({
          quantity: newQuantity,
          unitPrice: data.unitPrice,
          updatedAt: new Date(),
        })
        .where(eq(schema.cartItems.id, existing.id))
        .returning();
      if (!updated) throw new Error("Failed to update cart item");
      return updated;
    }

    const [created] = await db
      .insert(schema.cartItems)
      .values({
        cartId: data.cartId,
        productId: data.productId,
        variantId: data.variantId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
      })
      .returning();

    if (!created) throw new Error("Failed to insert cart item");
    return created;
  }

  async updateItemQuantity(cartItemId: string, quantity: number): Promise<CartItem | null> {
    if (quantity <= 0) {
      await this.deleteItem(cartItemId);
      return null;
    }

    const [updated] = await db
      .update(schema.cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(schema.cartItems.id, cartItemId))
      .returning();

    return updated ?? null;
  }

  async deleteItem(cartItemId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(schema.cartItems)
      .where(eq(schema.cartItems.id, cartItemId))
      .returning();
    return !!deleted;
  }

  async clearCart(cartId: string): Promise<void> {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cartId));
  }

  async mergeGuestCart(storeId: string, guestToken: string, userId: string): Promise<Cart> {
    const guestCart = await this.findCart(storeId, { guestToken });
    if (!guestCart) {
      const existingUserCart = await this.findCart(storeId, { userId });
      if (existingUserCart) return existingUserCart;
      return this.createCart({ storeId, userId });
    }

    let userCart = await this.findCart(storeId, { userId });
    if (!userCart) {
      // Re-assign the guest cart to the user
      const [assigned] = await db
        .update(schema.carts)
        .set({ userId, guestToken: null, updatedAt: new Date() })
        .where(eq(schema.carts.id, guestCart.id))
        .returning();
      if (assigned) return assigned;
      userCart = await this.createCart({ storeId, userId });
    }

    // Merge items from guest cart into user cart
    const guestItems = await db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, guestCart.id));

    for (const item of guestItems) {
      const [existingUserItem] = await db
        .select()
        .from(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.cartId, userCart.id),
            eq(schema.cartItems.variantId, item.variantId),
          ),
        )
        .limit(1);

      if (existingUserItem) {
        await db
          .update(schema.cartItems)
          .set({
            quantity: Math.min(10, existingUserItem.quantity + item.quantity),
            updatedAt: new Date(),
          })
          .where(eq(schema.cartItems.id, existingUserItem.id));
      } else {
        await db.insert(schema.cartItems).values({
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        });
      }
    }

    // Delete old guest cart
    await db.delete(schema.carts).where(eq(schema.carts.id, guestCart.id));
    return userCart;
  }
}

export const cartRepository = new CartRepository();
