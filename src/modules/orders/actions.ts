"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { cartService } from "@/modules/cart/service";
import { discountService } from "@/modules/discounts/service";
import { shippingService } from "@/modules/shipping/service";
import type { Address } from "@/modules/shipping/types";
import { orderService } from "./service";

async function getPrimaryStoreId(): Promise<string> {
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found");
  return store.id;
}

export async function calculateShippingRatesAction(destination: Address, weightGrams = 1000) {
  const storeId = await getPrimaryStoreId();
  return shippingService.calculateRates({
    storeId,
    destination,
    weightGrams,
    subtotalMinor: 0,
  });
}

export async function validateDiscountCodeAction(code: string, subtotalMinor: number) {
  const storeId = await getPrimaryStoreId();
  return discountService.validateAndCalculate({
    storeId,
    code,
    subtotalMinor,
  });
}

export async function submitCheckoutAction(input: {
  idempotencyKey: string;
  checkoutSessionId: string;
  guestEmail?: string;
  shippingAddress: Address;
  shippingCarrier: string;
  shippingService: string;
  shippingAmountMinor: number;
  discountCode?: string;
  items: {
    productId: string;
    variantId: string;
    quantity: number;
  }[];
  cartId?: string;
}) {
  const storeId = await getPrimaryStoreId();
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  const result = await orderService.createOrder({
    storeId,
    customerId: session?.user?.id ?? null,
    guestEmail: input.guestEmail ?? session?.user?.email ?? null,
    idempotencyKey: input.idempotencyKey,
    checkoutSessionId: input.checkoutSessionId,
    items: input.items,
    shippingAddress: input.shippingAddress,
    shippingCarrier: input.shippingCarrier,
    shippingService: input.shippingService,
    shippingAmountMinor: input.shippingAmountMinor,
    discountCode: input.discountCode,
  });

  // Clear customer cart upon successful checkout order creation
  if (input.cartId) {
    await cartService.clearCart(input.cartId);
  }

  revalidatePath("/cart");
  return {
    success: true,
    orderNumber: result.order.orderNumber,
    orderId: result.order.id,
  };
}
