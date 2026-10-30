import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogService } from "@/modules/catalog/service";
import type { ShippingAddress } from "@/modules/orders/schema";
import { orderService } from "@/modules/orders/service";
import { midtransPaymentProvider } from "@/modules/payments/providers/midtrans";
import { stripePaymentProvider } from "@/modules/payments/providers/stripe";
import { paymentService } from "@/modules/payments/service";

// Set environment variables for testing
process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-test-key-12345";
process.env.MIDTRANS_IS_PRODUCTION = "false";
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_webhook_123";

// MSW Server for mocking external payment gateway APIs
const server = setupServer(
  // Midtrans Snap transaction creation
  http.post("https://app.sandbox.midtrans.com/snap/v1/transactions", async () => {
    const token = `snap-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return HttpResponse.json({
      token,
      redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}`,
    });
  }),

  // Midtrans Status check
  http.get("https://api.sandbox.midtrans.com/v2/:orderNumber/status", async ({ params }) => {
    return HttpResponse.json({
      transaction_status: "settlement",
      gross_amount: "100000.00",
      currency: "IDR",
      transaction_id: `tx-${params.orderNumber}`,
      settlement_time: new Date().toISOString(),
    });
  }),

  // Midtrans Refund
  http.post("https://api.sandbox.midtrans.com/v2/:orderNumber/refund", async ({ params }) => {
    return HttpResponse.json({
      status_code: "200",
      status_message: "Success, refund request is approved",
      refund_id: `midtrans-ref-${params.orderNumber}`,
    });
  }),
);

describe("Phase 4 Payments, Webhooks, Integrity, & Refunds Suite", () => {
  let storeId: string;
  let testProductId: string;
  let testVariantId: string;
  let adminUserId: string;

  const mockAddress: ShippingAddress = {
    recipientName: "Budi Santoso",
    phone: "081298765432",
    street: "Jl. Kebon Jeruk No. 12",
    district: "Kebon Jeruk",
    city: "Jakarta Barat",
    province: "DKI Jakarta",
    postalCode: "11530",
    country: "Indonesia",
  };

  beforeAll(async () => {
    server.listen();

    // Provision store
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: "Mercato Payment Test Store",
        slug: `payment-test-${Date.now()}`,
        currency: "IDR",
        locale: "id",
      })
      .returning();
    storeId = store!.id;

    // Provision admin user for audit log verification
    const [adminUser] = await db
      .insert(schema.user)
      .values({
        id: `admin-${Date.now()}`,
        name: "Admin Tester",
        email: `admin-${Date.now()}@mercato.local`,
        role: "admin",
      })
      .returning();
    adminUserId = adminUser!.id;

    // Provision test product with stock = 10
    const product = await catalogService.createProductWithVariants(storeId, {
      name: "Mercato Premium Jacket",
      description: "High quality test jacket",
      status: "published",
      variants: [
        {
          title: "Size L",
          sku: `JKT-${Date.now()}`,
          price: 100000, // Rp 100.000
          stock: 10,
        },
      ],
    });

    testProductId = product.id;
    testVariantId = product.variants[0]!.id;
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(async () => {
    server.close();
  });

  it("1. Midtrans Snap Session Creation: successfully contacts API and persists session", async () => {
    const { order } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "budi@example.com",
      idempotencyKey: `pay-sess-${Date.now()}`,
      checkoutSessionId: `cs-${Date.now()}`,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 1 }],
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    const session = await paymentService.createSession(order.id, "midtrans");

    expect(session.provider).toBe("midtrans");
    expect(session.clientToken).toContain("snap-token-");
    expect(session.redirectUrl).toContain("vtweb/snap-token-");

    // Verify session record in DB
    const [dbSession] = await db
      .select()
      .from(schema.paymentSessions)
      .where(eq(schema.paymentSessions.orderId, order.id))
      .limit(1);

    expect(dbSession).toBeDefined();
    expect(dbSession?.providerSessionId).toBe(session.clientToken);
    expect(dbSession?.status).toBe("pending");
  });

  it("2. Midtrans Webhook Signature Verification: verifies valid SHA-512 and rejects tampering", async () => {
    const orderNumber = `ORD-SIG-${Date.now()}`;
    const statusCode = "200";
    const grossAmount = "110000.00";
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;

    // Compute expected signature
    const signature = crypto
      .createHash("sha512")
      .update(`${orderNumber}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");

    const validPayload = {
      order_id: orderNumber,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: "settlement",
      transaction_id: `midtrans-tx-${Date.now()}`,
    };

    const validResult = await midtransPaymentProvider.verifyWebhook(validPayload, {});
    expect(validResult.valid).toBe(true);
    expect(validResult.status).toBe("paid");
    expect(validResult.amountMinor).toBe(110000);

    // Tampered signature
    const tamperedPayload = {
      ...validPayload,
      signature_key: "tampered_signature_value_deadbeef",
    };

    const tamperedResult = await midtransPaymentProvider.verifyWebhook(tamperedPayload, {});
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.error).toContain("Cryptographic signature mismatch");
  });

  it("3. Stripe IDR Minor Unit Handling: converts IDR * 100 for Stripe and / 100 for Mercato", () => {
    // 1 IDR = 1 unit in Mercato (e.g. Rp 150.000 = 150000)
    // Stripe treats IDR as a two-decimal currency: Rp 150.000 = 15000000
    const mercatoIdr = 150000;
    const stripeAmount = stripePaymentProvider.toStripeAmount(mercatoIdr, "IDR");
    expect(stripeAmount).toBe(15000000);

    const convertedBack = stripePaymentProvider.fromStripeAmount(stripeAmount, "IDR");
    expect(convertedBack).toBe(150000);

    // USD is already standard 2 decimal places (2500 cents = $25.00)
    const usdAmount = 2500;
    expect(stripePaymentProvider.toStripeAmount(usdAmount, "USD")).toBe(2500);
    expect(stripePaymentProvider.fromStripeAmount(2500, "USD")).toBe(2500);
  });

  it("4. Webhook Idempotency: duplicate webhook calls return 'duplicate' and do not double-transition", async () => {
    const { order } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "idempotency@example.com",
      idempotencyKey: `idem-order-${Date.now()}`,
      checkoutSessionId: `cs-idem-${Date.now()}`,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 1 }],
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    const txId = `tx-idem-${Date.now()}`;
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const grossAmount = `${order.totalAmount}.00`;
    const signature = crypto
      .createHash("sha512")
      .update(`${order.orderNumber}200${grossAmount}${serverKey}`)
      .digest("hex");

    const payload = {
      order_id: order.orderNumber,
      status_code: "200",
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: "settlement",
      transaction_id: txId,
    };

    // First delivery -> processed
    const firstRes = await paymentService.handleWebhook("midtrans", payload, {});
    expect(firstRes.status).toBe("processed");

    // Check order is paid
    const updatedOrder = await orderService.getOrderById(order.id, storeId);
    expect(updatedOrder?.status).toBe("paid");
    expect(updatedOrder?.paymentStatus).toBe("paid");

    // Second delivery of same event -> duplicate
    const secondRes = await paymentService.handleWebhook("midtrans", payload, {});
    expect(secondRes.status).toBe("duplicate");
    expect(secondRes.message).toContain("already processed");
  });

  it("5. Amount Mismatch Rejection: rejects webhook with tampered payment amount", async () => {
    const { order } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "mismatch@example.com",
      idempotencyKey: `mismatch-order-${Date.now()}`,
      checkoutSessionId: `cs-mismatch-${Date.now()}`,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 1 }],
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    // Webhook with tampered amount (e.g. Rp 50.000 instead of real total)
    const tamperedAmount = "50000.00";
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const signature = crypto
      .createHash("sha512")
      .update(`${order.orderNumber}200${tamperedAmount}${serverKey}`)
      .digest("hex");

    const payload = {
      order_id: order.orderNumber,
      status_code: "200",
      gross_amount: tamperedAmount,
      signature_key: signature,
      transaction_status: "settlement",
      transaction_id: `tx-mismatch-${Date.now()}`,
    };

    await expect(paymentService.handleWebhook("midtrans", payload, {})).rejects.toThrow(
      /Payment amount mismatch/,
    );

    // Verify order is NOT marked paid
    const currentOrder = await orderService.getOrderById(order.id, storeId);
    expect(currentOrder?.status).toBe("awaiting_payment");
  });

  it("6. Late Payment Handling: A) stock available -> revives order to paid; B) stock exhausted -> triggers auto-refund", async () => {
    // Case A: Order cancelled but stock available
    const { order: orderA } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "late-a@example.com",
      idempotencyKey: `late-a-key-${Date.now()}`,
      checkoutSessionId: `cs-late-a-${Date.now()}`,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 1 }],
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    // Simulate order cancellation due to expiry
    await orderService.transitionOrderStatus(orderA.id, storeId, "cancelled", {
      reason: "Reservation expired",
    });

    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const grossAmountA = `${orderA.totalAmount}.00`;
    const sigA = crypto
      .createHash("sha512")
      .update(`${orderA.orderNumber}200${grossAmountA}${serverKey}`)
      .digest("hex");

    const payloadA = {
      order_id: orderA.orderNumber,
      status_code: "200",
      gross_amount: grossAmountA,
      signature_key: sigA,
      transaction_status: "settlement",
      transaction_id: `tx-late-a-${Date.now()}`,
    };

    // Late payment arrives
    const resA = await paymentService.handleWebhook("midtrans", payloadA, {});
    expect(resA.status).toBe("processed");

    const revivedOrder = await orderService.getOrderById(orderA.id, storeId);
    expect(revivedOrder?.status).toBe("paid");

    // Case B: Order cancelled and stock exhausted (stock = 0)
    // Provision zero-stock variant
    const zeroStockProduct = await catalogService.createProductWithVariants(storeId, {
      name: "Rare Artifact",
      description: "One-of-a-kind piece",
      status: "published",
      variants: [
        {
          title: "Standard",
          sku: `RARE-${Date.now()}`,
          price: 200000,
          stock: 0, // Exhausted
        },
      ],
    });
    const zeroVariantId = zeroStockProduct.variants[0]!.id;

    // Insert dummy cancelled order directly
    const [orderB] = await db
      .insert(schema.orders)
      .values({
        orderNumber: `ORD-ZERO-${Date.now()}`,
        storeId,
        guestEmail: "late-b@example.com",
        status: "cancelled",
        currency: "IDR",
        subtotal: 200000,
        shippingAmount: 10000,
        totalAmount: 210000,
        shippingCarrier: "JNE",
        shippingService: "REG",
        shippingAddress: mockAddress,
        guestAccessToken: "token-late-b",
        paymentProvider: "midtrans",
        idempotencyKey: `idem-late-b-${Date.now()}`,
        checkoutSessionId: `cs-late-b-${Date.now()}`,
      })
      .returning();

    await db.insert(schema.orderItems).values({
      orderId: orderB!.id,
      productId: zeroStockProduct.id,
      variantId: zeroVariantId,
      productName: zeroStockProduct.name,
      variantTitle: "Standard",
      sku: "RARE-1",
      unitPrice: 200000,
      quantity: 1,
      totalPrice: 200000,
    });

    const grossAmountB = `${orderB!.totalAmount}.00`;
    const sigB = crypto
      .createHash("sha512")
      .update(`${orderB!.orderNumber}200${grossAmountB}${serverKey}`)
      .digest("hex");

    const payloadB = {
      order_id: orderB!.orderNumber,
      status_code: "200",
      gross_amount: grossAmountB,
      signature_key: sigB,
      transaction_status: "settlement",
      transaction_id: `tx-late-b-${Date.now()}`,
    };

    const resB = await paymentService.handleWebhook("midtrans", payloadB, {});
    expect(resB.status).toBe("processed");

    // By default: order is marked needs_review, no automated provider refund is called
    const reviewedOrder = await orderService.getOrderById(orderB!.id, storeId);
    expect(reviewedOrder?.paymentStatus).toBe("needs_review");

    const noAutoRefund = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.orderId, orderB!.id));
    expect(noAutoRefund.length).toBe(0);

    // Verify audit log entry was created for manual merchant review
    const [auditEntry] = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityId, orderB!.id),
          eq(schema.auditLogs.action, "order.late_payment_flagged_for_review"),
        ),
      );
    expect(auditEntry).toBeDefined();
    const parsedDetails = JSON.parse(auditEntry!.details as string);
    expect(parsedDetails.reason).toContain("stock exhausted. Awaiting merchant manual review.");

    // C) Explicit setting test: when AUTO_REFUND_ON_STOCK_EXHAUSTED="true", provider refund IS called
    const origAutoRefund = process.env.AUTO_REFUND_ON_STOCK_EXHAUSTED;
    process.env.AUTO_REFUND_ON_STOCK_EXHAUSTED = "true";

    try {
      const [orderC] = await db
        .insert(schema.orders)
        .values({
          orderNumber: `ORD-ZERO-AUTO-${Date.now()}`,
          storeId,
          guestEmail: "late-c@example.com",
          status: "cancelled",
          currency: "IDR",
          subtotal: 200000,
          shippingAmount: 10000,
          totalAmount: 210000,
          shippingCarrier: "JNE",
          shippingService: "REG",
          shippingAddress: mockAddress,
          guestAccessToken: "token-late-c",
          paymentProvider: "midtrans",
          idempotencyKey: `idem-late-c-${Date.now()}`,
          checkoutSessionId: `cs-late-c-${Date.now()}`,
        })
        .returning();

      await db.insert(schema.orderItems).values({
        orderId: orderC!.id,
        productId: zeroStockProduct.id,
        variantId: zeroVariantId,
        productName: zeroStockProduct.name,
        variantTitle: "Standard",
        sku: "RARE-1",
        unitPrice: 200000,
        quantity: 1,
        totalPrice: 200000,
      });

      const grossAmountC = `${orderC!.totalAmount}.00`;
      const sigC = crypto
        .createHash("sha512")
        .update(`${orderC!.orderNumber}200${grossAmountC}${serverKey}`)
        .digest("hex");

      const payloadC = {
        order_id: orderC!.orderNumber,
        status_code: "200",
        gross_amount: grossAmountC,
        signature_key: sigC,
        transaction_status: "settlement",
        transaction_id: `tx-late-c-${Date.now()}`,
      };

      const resC = await paymentService.handleWebhook("midtrans", payloadC, {});
      expect(resC.status).toBe("processed");

      const autoRefundedOrder = await orderService.getOrderById(orderC!.id, storeId);
      expect(autoRefundedOrder?.paymentStatus).toBe("refunded");

      const [refundRecord] = await db
        .select()
        .from(schema.refunds)
        .where(eq(schema.refunds.orderId, orderC!.id))
        .limit(1);

      expect(refundRecord).toBeDefined();
      expect(refundRecord?.reason).toContain("stock exhausted");
    } finally {
      process.env.AUTO_REFUND_ON_STOCK_EXHAUSTED = origAutoRefund;
    }
  });

  it("7. Admin Refund Flow: processes provider refund, creates audit log, and optionally restocks inventory", async () => {
    // 1. Create paid order
    const { order } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "refund@example.com",
      idempotencyKey: `refund-order-${Date.now()}`,
      checkoutSessionId: `cs-refund-${Date.now()}`,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 2 }],
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    // Transition to paid and set paymentProvider
    await orderService.transitionOrderStatus(order.id, storeId, "paid", {
      reason: "Initial payment",
    });
    await db
      .update(schema.orders)
      .set({
        paymentProvider: "midtrans",
        paymentStatus: "paid",
        paymentTransactionId: `midtrans-tx-${order.orderNumber}`,
      })
      .where(eq(schema.orders.id, order.id));

    // Check stock before refund
    const [variantBefore] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, testVariantId))
      .limit(1);
    const initialStock = variantBefore!.stock;

    // Execute refund with restockInventory: true
    const refundRes = await paymentService.refundOrder({
      orderId: order.id,
      storeId,
      amountMinor: order.totalAmount,
      reason: "Customer changed mind",
      restockInventory: true,
      actorId: adminUserId,
    });

    expect(refundRes.success).toBe(true);
    expect(refundRes.providerRefundId).toBeDefined();

    // Verify order status updated to refunded
    const refundedOrder = await orderService.getOrderById(order.id, storeId);
    expect(refundedOrder?.status).toBe("refunded");
    expect(refundedOrder?.paymentStatus).toBe("refunded");

    // Verify refund row
    const [refundRecord] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.orderId, order.id))
      .limit(1);

    expect(refundRecord).toBeDefined();
    expect(refundRecord?.amount).toBe(order.totalAmount);
    expect(refundRecord?.restocked).toBe(true);

    // Verify inventory restocked (+2 units)
    const [variantAfter] = await db
      .select({ stock: schema.productVariants.stock })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, testVariantId))
      .limit(1);

    expect(variantAfter!.stock).toBe(initialStock + 2);

    // Verify audit log entry
    const [auditEntry] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, order.id))
      .limit(1);

    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe("orders.refund");
  });

  it("8. Payment Status Sync: applies status through the exact same transition path as webhooks", async () => {
    // Create an order awaiting payment
    const { order } = await orderService.createOrder({
      storeId,
      customerId: null,
      guestEmail: "sync@example.com",
      idempotencyKey: `sync-order-${Date.now()}`,
      checkoutSessionId: `cs-sync-${Date.now()}`,
      items: [{ productId: testProductId, variantId: testVariantId, quantity: 1 }],
      shippingAddress: mockAddress,
      shippingCarrier: "JNE",
      shippingService: "REG",
      shippingAmountMinor: 10000,
    });

    // Update payment provider to midtrans
    await db
      .update(schema.orders)
      .set({ paymentProvider: "midtrans" })
      .where(eq(schema.orders.id, order.id));

    // Mock getPaymentStatus on midtrans provider
    const midtransProvider = paymentService.getProvider("midtrans");
    const origGetPaymentStatus = midtransProvider.getPaymentStatus;
    midtransProvider.getPaymentStatus = vi.fn().mockResolvedValue({
      status: "paid",
      amountMinor: order.totalAmount,
      currency: order.currency,
      paymentTransactionId: `sync-tx-${Date.now()}`,
      settledAt: new Date(),
    });

    try {
      const syncedOrder = await paymentService.syncOrderStatus(order.id, storeId);
      expect(syncedOrder.status).toBe("paid");
      expect(syncedOrder.paymentStatus).toBe("paid");
      expect(syncedOrder.paymentTransactionId).toContain("sync-tx-");

      // Verify order status history was recorded
      const history = await orderService.getOrderStatusHistory(order.id);
      expect(history.some((h) => h.toStatus === "paid")).toBe(true);
    } finally {
      midtransProvider.getPaymentStatus = origGetPaymentStatus;
    }
  });
});
