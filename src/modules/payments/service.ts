import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { emailService } from "@/lib/email";
import { logger } from "@/lib/logger";
import { inventoryService } from "@/modules/inventory/service";
import type { Order, OrderItem, OrderStatus } from "@/modules/orders/schema";
import { orderService } from "@/modules/orders/service";
import { midtransPaymentProvider } from "./providers/midtrans";
import { stripePaymentProvider } from "./providers/stripe";
import type { PaymentProvider, PaymentSessionResult, RefundResult } from "./types";

export class PaymentService {
  private providers: Record<string, PaymentProvider> = {
    midtrans: midtransPaymentProvider,
    stripe: stripePaymentProvider,
  };

  getProvider(name: "midtrans" | "stripe"): PaymentProvider {
    const provider = this.providers[name];
    if (!provider) {
      throw new Error(`Unsupported payment provider: ${name}`);
    }
    return provider;
  }

  getActiveProviders(): { name: "midtrans" | "stripe"; title: string; available: boolean }[] {
    return [
      {
        name: "midtrans",
        title: "Midtrans (QRIS, GoPay, ShopeePay, Virtual Account)",
        available: midtransPaymentProvider.isAvailable(),
      },
      {
        name: "stripe",
        title: "Credit / Debit Card (Stripe)",
        available: stripePaymentProvider.isAvailable(),
      },
    ];
  }

  async createSession(
    orderId: string,
    providerName: "midtrans" | "stripe",
  ): Promise<PaymentSessionResult> {
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    if (!order) throw new Error("Order not found");

    const items = await orderService.getOrderItems(order.id);
    const provider = this.getProvider(providerName);

    const sessionResult = await provider.createPaymentSession(order, items);

    // Save payment session record
    await db.insert(schema.paymentSessions).values({
      orderId: order.id,
      provider: providerName,
      providerSessionId: sessionResult.providerSessionId,
      clientToken: sessionResult.clientToken ?? null,
      redirectUrl: sessionResult.redirectUrl ?? null,
      amount: order.totalAmount,
      currency: order.currency,
      status: "pending",
      expiresAt: sessionResult.expiresAt,
    });

    // Update order with selected provider
    await db
      .update(schema.orders)
      .set({
        paymentProvider: providerName,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, order.id));

    return sessionResult;
  }

  async handleWebhook(
    providerName: "midtrans" | "stripe",
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: string,
  ): Promise<{ status: "processed" | "ignored" | "duplicate"; message?: string }> {
    const provider = this.getProvider(providerName);
    const verification = await provider.verifyWebhook(payload, headers, rawBody);

    if (!verification.valid) {
      throw new Error(`Invalid webhook signature: ${verification.error}`);
    }

    // 1. Idempotency Check on providerEventId
    const [existingEvent] = await db
      .select()
      .from(schema.webhookEvents)
      .where(
        and(
          eq(schema.webhookEvents.provider, providerName),
          eq(schema.webhookEvents.providerEventId, verification.providerEventId),
        ),
      )
      .limit(1);

    if (existingEvent && existingEvent.status === "processed") {
      return { status: "duplicate", message: "Event already processed" };
    }

    if (!existingEvent) {
      await db.insert(schema.webhookEvents).values({
        provider: providerName,
        providerEventId: verification.providerEventId,
        eventType: verification.eventType,
        payload: payload as Record<string, unknown>,
        status: "pending",
      });
    }

    // 2. Resolve matching Order
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.orderNumber, verification.orderNumber))
      .limit(1);

    if (!order) {
      await db
        .update(schema.webhookEvents)
        .set({ status: "failed", errorMessage: "Order not found" })
        .where(eq(schema.webhookEvents.providerEventId, verification.providerEventId));
      return { status: "ignored", message: `Order ${verification.orderNumber} not found` };
    }

    // 3. Amount and Currency Integrity Validation
    if (verification.status === "paid") {
      if (
        verification.amountMinor !== order.totalAmount ||
        verification.currency !== order.currency
      ) {
        const errorMsg = `Payment amount mismatch: Expected ${order.totalAmount} ${order.currency}, received ${verification.amountMinor} ${verification.currency}`;
        await db
          .update(schema.webhookEvents)
          .set({ status: "failed", errorMessage: errorMsg })
          .where(eq(schema.webhookEvents.providerEventId, verification.providerEventId));
        throw new Error(errorMsg);
      }
    }

    // 4. Process State Machine Transition inside interactive Transaction
    await db.transaction(async (tx) => {
      let stockAvailable = true;

      if (verification.status === "paid") {
        if (order.status === "cancelled") {
          // Late payment policy: check whether inventory is still available
          const items = await orderService.getOrderItems(order.id);
          for (const item of items) {
            const [variant] = await tx
              .select({ stock: schema.productVariants.stock })
              .from(schema.productVariants)
              .where(eq(schema.productVariants.id, item.variantId))
              .limit(1);
            if (!variant || variant.stock < item.quantity) {
              stockAvailable = false;
              break;
            }
          }

          if (stockAvailable) {
            // Deduct available stock and revive order
            for (const item of items) {
              await tx
                .update(schema.productVariants)
                .set({
                  stock: sql`${schema.productVariants.stock} - ${item.quantity}`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.productVariants.id, item.variantId));
            }
            await orderService.transitionOrderStatus(order.id, order.storeId, "paid", {
              reason: `Late payment accepted; stock re-reserved and confirmed via ${providerName}`,
              actorId: providerName,
            });
            await tx
              .update(schema.orders)
              .set({
                paymentStatus: "paid",
                paymentTransactionId: verification.paymentTransactionId ?? null,
                updatedAt: new Date(),
              })
              .where(eq(schema.orders.id, order.id));
          } else {
            // Stock is no longer available: trigger automatic refund
            logger.warn(
              { orderId: order.id, orderNumber: order.orderNumber },
              "Late payment received but stock exhausted. Processing auto-refund.",
            );
            try {
              const refundRes = await provider.processRefund({
                order,
                amountMinor: verification.amountMinor,
                reason: "Late payment auto-refund (stock exhausted)",
              });
              await tx.insert(schema.refunds).values({
                orderId: order.id,
                providerRefundId: refundRes.providerRefundId ?? null,
                amount: verification.amountMinor,
                currency: order.currency,
                reason: "Late payment auto-refund (stock exhausted)",
                restocked: false,
                status: "completed",
              });
              await tx
                .update(schema.orders)
                .set({
                  paymentStatus: "refunded",
                  updatedAt: new Date(),
                })
                .where(eq(schema.orders.id, order.id));
            } catch (refundErr) {
              logger.error(
                { err: refundErr, orderId: order.id },
                "Auto-refund failed for late payment",
              );
            }
          }
        } else if (order.status !== "paid") {
          // Normal payment: transition state machine and commit inventory reservations
          await orderService.transitionOrderStatus(order.id, order.storeId, "paid", {
            reason: `Payment verified via ${providerName} (TxID: ${verification.paymentTransactionId})`,
            actorId: providerName,
          });

          // Update payment status & transaction ID
          await tx
            .update(schema.orders)
            .set({
              paymentStatus: "paid",
              paymentTransactionId: verification.paymentTransactionId ?? null,
              updatedAt: new Date(),
            })
            .where(eq(schema.orders.id, order.id));
        }

        // Send payment received email if order is active/paid (not auto-refunded due to exhausted stock)
        const isRevivedOrPaid = order.status !== "cancelled" || stockAvailable;
        const customerEmail =
          isRevivedOrPaid &&
          (order.guestEmail ||
            (order.customerId
              ? (
                  await db
                    .select({ email: schema.user.email })
                    .from(schema.user)
                    .where(eq(schema.user.id, order.customerId))
                    .limit(1)
                )[0]?.email
              : null));

        if (customerEmail) {
          const formattedTotal = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: order.currency,
          }).format(order.totalAmount);

          await emailService
            .sendPaymentReceivedEmail({
              to: customerEmail,
              orderNumber: order.orderNumber,
              totalAmountFormatted: formattedTotal,
              paymentMethod: providerName.toUpperCase(),
              orderUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders/${order.orderNumber}?token=${order.guestAccessToken}`,
            })
            .catch((err) => {
              logger.error(
                { err, orderNumber: order.orderNumber },
                "Failed to send payment received email",
              );
            });
        }
      } else if (verification.status === "cancelled") {
        if (order.status === "awaiting_payment") {
          await orderService.transitionOrderStatus(order.id, order.storeId, "cancelled", {
            reason: `Payment failed/expired via ${providerName}`,
            actorId: providerName,
          });

          await tx
            .update(schema.orders)
            .set({
              paymentStatus: "failed",
              updatedAt: new Date(),
            })
            .where(eq(schema.orders.id, order.id));
        }
      } else if (verification.status === "refunded") {
        if (order.status !== "refunded") {
          await orderService.transitionOrderStatus(order.id, order.storeId, "refunded", {
            reason: `Refund confirmed via ${providerName}`,
            actorId: providerName,
          });

          await tx
            .update(schema.orders)
            .set({
              paymentStatus: "refunded",
              updatedAt: new Date(),
            })
            .where(eq(schema.orders.id, order.id));
        }
      }

      // Mark webhook event processed
      await tx
        .update(schema.webhookEvents)
        .set({
          status: "processed",
          processedAt: new Date(),
        })
        .where(eq(schema.webhookEvents.providerEventId, verification.providerEventId));
    });

    return { status: "processed" };
  }

  async syncOrderStatus(orderId: string, storeId: string): Promise<Order> {
    const order = await orderService.getOrderById(orderId, storeId);
    if (!order) throw new Error("Order not found");

    if (!order.paymentProvider) {
      return order;
    }

    const provider = this.getProvider(order.paymentProvider as "midtrans" | "stripe");
    const statusResult = await provider.getPaymentStatus(order.orderNumber);

    if (statusResult.status !== order.status) {
      return orderService.transitionOrderStatus(order.id, storeId, statusResult.status, {
        reason: `Payment status synced from ${order.paymentProvider}`,
        actorId: "system_sync",
      });
    }

    return order;
  }

  async refundOrder(params: {
    orderId: string;
    storeId: string;
    amountMinor: number;
    reason?: string;
    restockInventory?: boolean;
    actorId?: string;
  }): Promise<RefundResult> {
    const order = await orderService.getOrderById(params.orderId, params.storeId);
    if (!order) throw new Error("Order not found");

    if (order.status !== "paid" && order.status !== "delivered") {
      throw new Error(`Cannot refund order in '${order.status}' status. Order must be paid.`);
    }

    if (!order.paymentProvider) {
      throw new Error("Order does not have a recorded payment provider.");
    }

    const provider = this.getProvider(order.paymentProvider as "midtrans" | "stripe");
    const refundResult = await provider.processRefund({
      order,
      amountMinor: params.amountMinor,
      reason: params.reason,
    });

    if (!refundResult.success) {
      throw new Error(`Refund failed: ${refundResult.error}`);
    }

    // Record in refunds table & update order status inside transaction
    await db.transaction(async (tx) => {
      await tx.insert(schema.refunds).values({
        orderId: order.id,
        providerRefundId: refundResult.providerRefundId ?? null,
        amount: params.amountMinor,
        currency: order.currency,
        reason: params.reason ?? null,
        restocked: params.restockInventory ?? false,
        status: "completed",
      });

      // Audit log entry
      await tx.insert(schema.auditLogs).values({
        storeId: params.storeId,
        action: "orders.refund",
        entityType: "order",
        entityId: order.id,
        userId: params.actorId ?? null,
        details: JSON.stringify({
          orderNumber: order.orderNumber,
          amountMinor: params.amountMinor,
          currency: order.currency,
          reason: params.reason,
          restocked: params.restockInventory ?? false,
          providerRefundId: refundResult.providerRefundId,
        }),
      });

      // Restock inventory if requested
      if (params.restockInventory) {
        const items = await orderService.getOrderItems(order.id);
        for (const item of items) {
          await tx
            .update(schema.productVariants)
            .set({
              stock: sql`${schema.productVariants.stock} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(schema.productVariants.id, item.variantId));
        }
      }

      await orderService.transitionOrderStatus(order.id, params.storeId, "refunded", {
        reason: `Refund processed: ${params.reason ?? "Customer refund"}`,
        actorId: params.actorId ?? "admin",
      });

      await tx
        .update(schema.orders)
        .set({
          paymentStatus: "refunded",
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, order.id));
    });

    return refundResult;
  }
}

export const paymentService = new PaymentService();
