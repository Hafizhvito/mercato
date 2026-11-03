"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { emailService } from "@/lib/email";
import { logger } from "@/lib/logger";
import { cartService } from "@/modules/cart/service";
import { discountService } from "@/modules/discounts/service";
import { shippingService } from "@/modules/shipping/service";
import type { Address } from "@/modules/shipping/types";
import { assertPermission, assertStoreAccess } from "@/server/guards";
import { orderService } from "./service";
import { type OrderStatus, validateOrderTransition } from "./state-machine";

async function getPrimaryStoreId(): Promise<string> {
  const [store] = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (!store) throw new Error("No configured store found");
  return store.id;
}

async function getAuthenticatedUser() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    throw new Error("Authentication required: Please log in to perform administrative actions.");
  }
  return session.user;
}

async function getCustomerEmail(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const [u] = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, customerId))
    .limit(1);
  return u?.email || null;
}

// -------------------------------------------------------------
// Storefront Checkout Actions
// -------------------------------------------------------------

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

  // Trigger order confirmation email
  const emailTo = input.guestEmail ?? session?.user?.email;
  if (emailTo) {
    const formattedTotal = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: result.order.currency,
    }).format(result.order.totalAmount);

    emailService
      .sendOrderConfirmationEmail({
        to: emailTo,
        orderNumber: result.order.orderNumber,
        totalAmountFormatted: formattedTotal,
        orderUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders/${result.order.orderNumber}?token=${result.order.guestAccessToken}`,
      })
      .catch((err) => {
        logger.error(
          { err, orderNumber: result.order.orderNumber },
          "Failed to send order confirmation email",
        );
      });
  }

  revalidatePath("/cart");
  return {
    success: true,
    orderNumber: result.order.orderNumber,
    orderId: result.order.id,
    guestAccessToken: result.order.guestAccessToken,
  };
}

// -------------------------------------------------------------
// Back-Office Admin Actions (Guarded by Permissions)
// -------------------------------------------------------------

/**
 * Fulfills an order through the state machine:
 * - paid -> processing
 * - processing -> shipped (carrier & tracking required)
 * - shipped -> delivered
 */
export async function fulfillOrderAction(input: {
  orderId: string;
  status: "processing" | "shipped" | "delivered";
  carrier?: string;
  trackingNumber?: string;
}) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "orders:fulfill");

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new Error("Order not found");
  }

  assertStoreAccess(user, order.storeId);
  validateOrderTransition(order.status as OrderStatus, input.status);

  if (input.status === "shipped") {
    if (!input.carrier?.trim() || !input.trackingNumber?.trim()) {
      throw new Error(
        "Fulfillment Error: Shipping carrier and tracking number are required when marking an order as shipped.",
      );
    }
  }

  const now = new Date();
  const updateData: Partial<typeof schema.orders.$inferInsert> = {
    status: input.status,
    updatedAt: now,
  };

  if (input.status === "shipped") {
    updateData.shippingCarrier = input.carrier?.trim();
    updateData.shippingTrackingNumber = input.trackingNumber?.trim();
    updateData.shippedAt = now;
  } else if (input.status === "delivered") {
    updateData.deliveredAt = now;
  }

  await db.transaction(async (tx) => {
    // 1. Update order
    await tx.update(schema.orders).set(updateData).where(eq(schema.orders.id, order.id));

    // 2. Record status history
    await tx.insert(schema.orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: input.status,
      actorId: user.id,
      reason:
        input.status === "shipped"
          ? `Order marked as shipped via ${input.carrier} (Tracking: ${input.trackingNumber})`
          : `Order fulfilled: status updated to ${input.status}`,
    });

    // 3. Record audit log
    await tx.insert(schema.auditLogs).values({
      storeId: order.storeId,
      userId: user.id,
      action: `order.status.${input.status}`,
      entityType: "order",
      entityId: order.id,
      details: JSON.stringify({
        from: order.status,
        to: input.status,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
      }),
    });
  });

  // 4. Send customer shipped email notification
  if (input.status === "shipped") {
    const customerEmail = order.guestEmail || (await getCustomerEmail(order.customerId));
    if (customerEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const trackingUrl = `${appUrl}/orders/${order.orderNumber}?token=${order.guestAccessToken}`;
      try {
        await emailService.sendOrderShippedEmail({
          to: customerEmail,
          orderNumber: order.orderNumber,
          trackingNumber: input.trackingNumber?.trim() || order.shippingTrackingNumber || "-",
          carrier: input.carrier?.trim() || order.shippingCarrier || "Standard",
          trackingUrl,
          locale: "id",
        });
      } catch (err) {
        logger.error({ err, orderId: order.id }, "Failed to dispatch shipping notification email");
      }
    }
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/admin/orders`);
  revalidatePath(`/orders/${order.orderNumber}`);

  return { success: true };
}

/**
 * Cancels an unpaid order and releases any reserved inventory stock.
 */
export async function cancelUnpaidOrderAction(input: { orderId: string; reason: string }) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "orders:cancel_unpaid");

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new Error("Order not found");
  }

  assertStoreAccess(user, order.storeId);

  if (order.status !== "awaiting_payment" && order.status !== "pending") {
    throw new Error(
      `Cannot cancel order with status '${order.status}'. Only unpaid orders may be cancelled directly. Paid orders must be refunded.`,
    );
  }

  await db.transaction(async (tx) => {
    // 1. Release active stock reservations
    if (order.checkoutSessionId) {
      await tx
        .update(schema.stockReservations)
        .set({ status: "released", updatedAt: new Date() })
        .where(
          and(
            eq(schema.stockReservations.checkoutSessionId, order.checkoutSessionId),
            eq(schema.stockReservations.status, "active"),
          ),
        );
    }

    // 2. Mark order cancelled
    await tx
      .update(schema.orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(schema.orders.id, order.id));

    // 3. Status history
    await tx.insert(schema.orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "cancelled",
      actorId: user.id,
      reason: input.reason || "Unpaid order cancelled by staff",
    });

    // 4. Audit log
    await tx.insert(schema.auditLogs).values({
      storeId: order.storeId,
      userId: user.id,
      action: "order.cancelled_unpaid",
      entityType: "order",
      entityId: order.id,
      details: JSON.stringify({ reason: input.reason }),
    });
  });

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/admin/orders`);

  return { success: true };
}

/**
 * Appends an internal staff-only note to an order.
 * Never exposed to storefront customers.
 */
export async function addOrderNoteAction(input: { orderId: string; note: string }) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "orders:notes");

  if (!input.note?.trim()) {
    throw new Error("Note content cannot be empty.");
  }

  const [order] = await db
    .select({ id: schema.orders.id, storeId: schema.orders.storeId })
    .from(schema.orders)
    .where(eq(schema.orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new Error("Order not found");
  }

  assertStoreAccess(user, order.storeId);

  await db.transaction(async (tx) => {
    await tx.insert(schema.orderNotes).values({
      orderId: order.id,
      authorId: user.id,
      authorName: user.name || user.email || "Staff",
      note: input.note.trim(),
    });

    await tx.insert(schema.auditLogs).values({
      storeId: order.storeId,
      userId: user.id,
      action: "order.note_added",
      entityType: "order",
      entityId: order.id,
      details: JSON.stringify({ noteSnippet: input.note.trim().slice(0, 50) }),
    });
  });

  revalidatePath(`/admin/orders/${order.id}`);
  return { success: true };
}

/**
 * Resolves a late payment in "needs_review" status:
 * Checks if stock is available to re-reserve and revives order to paid.
 */
export async function acceptLatePaymentAction(input: { orderId: string }) {
  const user = await getAuthenticatedUser();
  assertPermission(user, "orders:fulfill");

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new Error("Order not found");
  }

  assertStoreAccess(user, order.storeId);

  if (order.paymentStatus !== "needs_review") {
    throw new Error(
      "Only orders with 'needs_review' payment status can be accepted via this action.",
    );
  }

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id));

  // Check inventory availability and commit
  await db.transaction(async (tx) => {
    for (const item of items) {
      const [variant] = await tx
        .select({ id: schema.productVariants.id, stock: schema.productVariants.stock })
        .from(schema.productVariants)
        .where(eq(schema.productVariants.id, item.variantId))
        .for("update");

      if (!variant || variant.stock < item.quantity) {
        throw new Error(
          `Insufficient stock to accept order: Item '${item.productName}' (${item.variantTitle}) has ${variant?.stock ?? 0} units available, but requires ${item.quantity}. Please restock the variant or refund the order.`,
        );
      }

      await tx
        .update(schema.productVariants)
        .set({
          stock: sql`${schema.productVariants.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.productVariants.id, item.variantId));
    }

    // Revive order status to paid and clear review flag
    await tx
      .update(schema.orders)
      .set({
        status: "paid",
        paymentStatus: "paid",
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, order.id));

    // Record transition history
    await tx.insert(schema.orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "paid",
      actorId: user.id,
      reason: "Late payment accepted by merchant after stock re-verification.",
    });

    // Record audit log
    await tx.insert(schema.auditLogs).values({
      storeId: order.storeId,
      userId: user.id,
      action: "order.late_payment_accepted",
      entityType: "order",
      entityId: order.id,
      details: JSON.stringify({ acceptedBy: user.email }),
    });
  });

  // Dispatch payment confirmation email
  const customerEmail = order.guestEmail || (await getCustomerEmail(order.customerId));
  if (customerEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await emailService.sendPaymentReceivedEmail({
        to: customerEmail,
        orderNumber: order.orderNumber,
        totalAmountFormatted: `${order.currency} ${order.totalAmount}`,
        paymentMethod: order.paymentProvider?.toUpperCase() || "GATEWAY",
        orderUrl: `${appUrl}/orders/${order.orderNumber}?token=${order.guestAccessToken}`,
        locale: "id",
      });
    } catch (err) {
      logger.error(
        { err, orderId: order.id },
        "Failed to send payment confirmation email on late payment acceptance",
      );
    }
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/admin/orders`);
  return { success: true };
}
