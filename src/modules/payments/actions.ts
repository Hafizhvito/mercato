"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { paymentService } from "./service";

async function getPrimaryStoreId(): Promise<string> {
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found");
  return store.id;
}

export async function createPaymentSessionAction(orderId: string, provider: "midtrans" | "stripe") {
  return paymentService.createSession(orderId, provider);
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
