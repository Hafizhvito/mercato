"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { authRateLimiter } from "@/lib/cache/ratelimit";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { orderService } from "@/modules/orders/service";
import { paymentService } from "./service";

async function getPrimaryStoreId(): Promise<string> {
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found");
  return store.id;
}

export async function getAvailablePaymentProvidersAction(): Promise<("midtrans" | "stripe")[]> {
  return paymentService.getAvailableProviders();
}

export async function createPaymentSessionAction(orderId: string, provider: "midtrans" | "stripe") {
  return paymentService.createSession(orderId, provider);
}

export async function checkPaymentStatusAction(input: {
  orderNumber: string;
  token?: string;
  locale?: string;
}) {
  const storeId = await getPrimaryStoreId();
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  // Rate limit check: maximum 10 status syncs per minute per order
  const clientIp = reqHeaders.get("x-forwarded-for") || "unknown";
  const rateLimitKey = `payment-status-check:${input.orderNumber}:${clientIp}`;
  const rateCheck = await authRateLimiter.limit(rateLimitKey);

  if (!rateCheck.success) {
    throw new Error("Too many status check requests. Please wait a minute before checking again.");
  }

  // Access control validation (same as order confirmation page)
  const access = await orderService.verifyOrderAccess({
    orderNumber: input.orderNumber,
    storeId,
    userId: session?.user?.id ?? null,
    userRole: (session?.user as { role?: string })?.role ?? null,
    token: input.token ?? null,
  });

  if (!access.authorized || !access.order) {
    throw new Error("Unauthorized: Access to this order is restricted.");
  }

  const updatedOrder = await paymentService.syncOrderStatus(access.order.id, storeId);

  // Revalidate order page
  const locale = input.locale ?? "id";
  revalidatePath(`/${locale}/orders/${input.orderNumber}`);

  return {
    success: true,
    status: updatedOrder.status,
    paymentStatus: updatedOrder.paymentStatus,
  };
}

export async function refundOrderAction(input: {
  orderId: string;
  amountMinor: number;
  reason?: string;
  restockInventory?: boolean;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user?.role || !["admin", "owner", "staff"].includes(session.user.role)) {
    throw new Error("Unauthorized: Only merchant administrators may issue refunds.");
  }

  const storeId = await getPrimaryStoreId();

  return paymentService.refundOrder({
    orderId: input.orderId,
    storeId,
    amountMinor: input.amountMinor,
    reason: input.reason,
    restockInventory: input.restockInventory,
    actorId: session.user.id,
  });
}
