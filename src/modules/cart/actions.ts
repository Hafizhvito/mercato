"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { cartService } from "./service";

const CART_COOKIE_NAME = "mercato_cart_token";

async function getOrCreateCartIdentity(_storeId: string): Promise<{
  guestToken?: string;
  userId?: string;
}> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  const cookieStore = await cookies();
  let guestToken = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!guestToken) {
    guestToken = crypto.randomUUID();
    cookieStore.set(CART_COOKIE_NAME, guestToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return { guestToken };
}

async function getPrimaryStoreId(): Promise<string> {
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found");
  return store.id;
}

export async function getCartAction() {
  const storeId = await getPrimaryStoreId();
  const identity = await getOrCreateCartIdentity(storeId);
  return cartService.getDetailedCart(storeId, identity);
}

export async function addToCartAction(input: {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}) {
  const storeId = await getPrimaryStoreId();
  const identity = await getOrCreateCartIdentity(storeId);

  await cartService.addItem(storeId, {
    ...identity,
    productId: input.productId,
    variantId: input.variantId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  });

  revalidatePath("/cart");
  return { success: true };
}

export async function updateCartItemQuantityAction(input: {
  cartItemId: string;
  quantity: number;
}) {
  await cartService.updateItemQuantity(input.cartItemId, input.quantity);
  revalidatePath("/cart");
  return { success: true };
}

export async function removeCartItemAction(input: { cartItemId: string }) {
  await cartService.removeItem(input.cartItemId);
  revalidatePath("/cart");
  return { success: true };
}

export async function mergeGuestCartAction(guestToken: string) {
  const storeId = await getPrimaryStoreId();
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user?.id) return { success: false };

  const mergedCart = await cartService.mergeOnLogin(storeId, guestToken, session.user.id);
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE_NAME);

  revalidatePath("/cart");
  return { success: true, cartId: mergedCart.id };
}
