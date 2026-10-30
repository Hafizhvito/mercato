import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { discountService } from "@/modules/discounts/service";
import { inventoryService } from "@/modules/inventory/service";
import { shippingService } from "@/modules/shipping/service";
import type { NewOrder, Order, OrderItem, OrderStatus, ShippingAddress } from "./schema";
import { validateOrderTransition } from "./state-machine";

export interface CreateOrderParams {
  storeId: string;
  customerId?: string | null;
  guestEmail?: string | null;
  idempotencyKey: string;
  checkoutSessionId: string;
  items: {
    productId: string;
    variantId: string;
    quantity: number;
  }[];
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  shippingCarrier: string;
  shippingService: string;
  shippingAmountMinor: number;
  discountCode?: string;
}

export class OrderService {
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `MRC-${timestamp}-${randomHex}`;
  }

  async getOrderById(orderId: string, storeId: string): Promise<Order | null> {
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.storeId, storeId)))
      .limit(1);
    return order ?? null;
  }

  async getOrderByNumber(orderNumber: string, storeId: string): Promise<Order | null> {
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.orderNumber, orderNumber), eq(schema.orders.storeId, storeId)))
      .limit(1);
    return order ?? null;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  }

  async getOrderStatusHistory(orderId: string) {
    return db
      .select()
      .from(schema.orderStatusHistory)
      .where(eq(schema.orderStatusHistory.orderId, orderId))
      .orderBy(desc(schema.orderStatusHistory.createdAt));
  }

  /**
   * Creates an order with strict stock reservation, server-side price validation,
   * discount validation, and idempotency key safety.
   */
  async createOrder(params: CreateOrderParams): Promise<{
    order: Order;
    items: OrderItem[];
    isExisting: boolean;
  }> {
    // 1. Idempotency Check
    const [existingOrder] = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.storeId, params.storeId),
          eq(schema.orders.idempotencyKey, params.idempotencyKey),
        ),
      )
      .limit(1);

    if (existingOrder) {
      const items = await this.getOrderItems(existingOrder.id);
      return { order: existingOrder, items, isExisting: true };
    }

    if (!params.items || params.items.length === 0) {
      throw new Error("Cannot create order with an empty item set");
    }

    // 2. Reserve stock with 15-minute TTL via SELECT ... FOR UPDATE
    const reservationResult = await inventoryService.reserveStock({
      storeId: params.storeId,
      checkoutSessionId: params.checkoutSessionId,
      items: params.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    });

    if (!reservationResult.success) {
      throw new Error(reservationResult.error ?? "Failed to reserve stock");
    }

    // 3. Atomically compile line items, snapshot pricing, validate discounts, and create records
    return db.transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsToInsert: {
        productId: string;
        variantId: string;
        productName: string;
        variantTitle: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[] = [];

      for (const item of params.items) {
        const [variantRow] = await tx
          .select({
            id: schema.productVariants.id,
            productId: schema.productVariants.productId,
            title: schema.productVariants.title,
            sku: schema.productVariants.sku,
            price: schema.productVariants.price,
            productName: schema.products.name,
          })
          .from(schema.productVariants)
          .innerJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
          .where(
            and(
              eq(schema.productVariants.id, item.variantId),
              eq(schema.products.storeId, params.storeId),
            ),
          )
          .limit(1);

        if (!variantRow) {
          throw new Error(`Variant ${item.variantId} not found in store catalog`);
        }

        const unitPrice = variantRow.price;
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;

        orderItemsToInsert.push({
          productId: variantRow.productId,
          variantId: variantRow.id,
          productName: variantRow.productName,
          variantTitle: variantRow.title,
          sku: variantRow.sku,
          quantity: item.quantity,
          unitPrice,
          totalPrice: lineTotal,
        });
      }

      // Recompute shipping rate server-side to guarantee integrity against client price tampering
      const computedRates = await shippingService.calculateRates({
        storeId: params.storeId,
        destination: params.shippingAddress,
        weightGrams: params.items.reduce((acc, it) => acc + it.quantity * 500, 500),
        subtotalMinor: subtotal,
      });

      const matchedRate = computedRates.find(
        (r) =>
          r.carrier.toLowerCase() === params.shippingCarrier.toLowerCase() &&
          r.service.toLowerCase() === params.shippingService.toLowerCase(),
      );

      if (!matchedRate) {
        throw new Error(
          `Invalid or unsupported shipping method '${params.shippingCarrier} ${params.shippingService}' for destination`,
        );
      }

      let verifiedShippingAmount = matchedRate.costMinor;

      // Handle discount calculation and atomic usage
      let discountAmount = 0;
      let appliedDiscountId: string | null = null;

      if (params.discountCode) {
        const discountCheck = await discountService.validateAndCalculate({
          storeId: params.storeId,
          code: params.discountCode,
          subtotalMinor: subtotal,
          shippingAmountMinor: verifiedShippingAmount,
        });

        if (discountCheck.valid && discountCheck.discount) {
          discountAmount = discountCheck.discountAmountMinor;
          appliedDiscountId = discountCheck.discount.id;

          if (discountCheck.discount.type === "free_shipping") {
            verifiedShippingAmount = 0;
          }

          const incremented = await discountService.incrementUsage(discountCheck.discount.id, tx);
          if (!incremented) {
            throw new Error("Coupon usage limit exceeded during concurrent order placement");
          }
        }
      }

      const totalAmount = Math.max(0, subtotal - discountAmount + verifiedShippingAmount);
      const orderNumber = this.generateOrderNumber();
      const guestAccessToken = crypto.randomBytes(32).toString("hex");

      const newOrderData: NewOrder = {
        orderNumber,
        storeId: params.storeId,
        customerId: params.customerId ?? null,
        guestEmail: params.guestEmail ?? null,
        status: "awaiting_payment",
        paymentStatus: "unpaid",
        currency: "IDR",
        subtotal,
        discountAmount,
        shippingAmount: verifiedShippingAmount,
        taxAmount: 0,
        totalAmount,
        discountId: appliedDiscountId,
        shippingCarrier: matchedRate.carrier,
        shippingService: matchedRate.service,
        shippingAddress: params.shippingAddress,
        billingAddress: params.billingAddress ?? null,
        guestAccessToken,
        idempotencyKey: params.idempotencyKey,
        checkoutSessionId: params.checkoutSessionId,
      };

      const [createdOrder] = await tx.insert(schema.orders).values(newOrderData).returning();
      if (!createdOrder) {
        throw new Error("Failed to insert order record");
      }

      // Insert line items with snapshots
      const insertedItems = await tx
        .insert(schema.orderItems)
        .values(
          orderItemsToInsert.map((item) => ({
            ...item,
            orderId: createdOrder.id,
          })),
        )
        .returning();

      // Record initial audit status history
      await tx.insert(schema.orderStatusHistory).values({
        orderId: createdOrder.id,
        fromStatus: null,
        toStatus: "awaiting_payment",
        reason: "Order placed at checkout",
        actorId: params.customerId ?? "guest",
      });

      return {
        order: createdOrder,
        items: insertedItems,
        isExisting: false,
      };
    });
  }

  /**
   * Transitions order state with validation and side effects (reservation commit/release)
   */
  async transitionOrderStatus(
    orderId: string,
    storeId: string,
    nextStatus: OrderStatus,
    options: { reason?: string; actorId?: string } = {},
  ): Promise<Order> {
    const order = await this.getOrderById(orderId, storeId);
    if (!order) {
      throw new Error("Order not found");
    }

    const currentStatus = order.status as OrderStatus;
    validateOrderTransition(currentStatus, nextStatus);

    if (currentStatus === nextStatus) {
      return order;
    }

    return db.transaction(async (tx) => {
      // Commit reservations when order transitions to 'paid'
      if (nextStatus === "paid") {
        await inventoryService.commitReservations(order.checkoutSessionId, order.id);
      }

      // Release reservations if order cancelled before payment
      if (nextStatus === "cancelled" && currentStatus === "awaiting_payment") {
        await inventoryService.releaseReservations(order.checkoutSessionId);
      }

      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.orders.id, orderId), eq(schema.orders.storeId, storeId)))
        .returning();

      if (!updatedOrder) {
        throw new Error("Failed to update order status");
      }

      await tx.insert(schema.orderStatusHistory).values({
        orderId: order.id,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        reason: options.reason ?? null,
        actorId: options.actorId ?? "system",
      });

      return updatedOrder;
    });
  }

  /**
   * Verifies that the requester has legitimate authorization to access the order (IDOR Protection)
   */
  async verifyOrderAccess(params: {
    orderNumber: string;
    storeId: string;
    userId?: string | null;
    userRole?: string | null;
    token?: string | null;
  }): Promise<{ authorized: boolean; order?: Order; reason?: string }> {
    const order = await this.getOrderByNumber(params.orderNumber, params.storeId);
    if (!order) {
      return { authorized: false, reason: "NOT_FOUND" };
    }

    // 1. Administrative roles have full visibility
    if (params.userRole && ["admin", "owner", "staff"].includes(params.userRole)) {
      return { authorized: true, order };
    }

    // 2. Authenticated user who placed the order
    if (params.userId && order.customerId && params.userId === order.customerId) {
      return { authorized: true, order };
    }

    // 3. Guest lookup with unguessable cryptographic access token
    if (params.token && order.guestAccessToken && params.token === order.guestAccessToken) {
      return { authorized: true, order };
    }

    return { authorized: false, reason: "UNAUTHORIZED" };
  }
}

export const orderService = new OrderService();
