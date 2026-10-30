import Stripe from "stripe";
import { env } from "@/lib/env";
import type { Order, OrderItem, OrderStatus } from "@/modules/orders/schema";
import type {
  PaymentProvider,
  PaymentSessionResult,
  PaymentStatusResult,
  RefundResult,
  WebhookVerificationResult,
} from "../types";

export class StripePaymentProvider implements PaymentProvider {
  name = "stripe" as const;
  private stripeClient: Stripe | null = null;

  private get secretKey(): string {
    return process.env.STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY ?? "";
  }

  private get webhookSecret(): string {
    return process.env.STRIPE_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET ?? "";
  }

  private get client(): Stripe {
    if (!this.stripeClient) {
      if (!this.secretKey) {
        throw new Error("Stripe secret key is not configured.");
      }
      this.stripeClient = new Stripe(this.secretKey, {
        apiVersion: "2026-03-23.acacia" as any,
        typescript: true,
      });
    }
    return this.stripeClient;
  }

  isAvailable(): boolean {
    const key = this.secretKey.trim();
    if (!key || key.length < 15) return false;
    // Strictly treat sample/placeholder keys from .env.example as unconfigured
    if (
      key === "sk_test_sample_stripe_secret_key" ||
      key.includes("sample_stripe") ||
      key.includes("dummy") ||
      key.includes("example")
    ) {
      return false;
    }
    return key.startsWith("sk_test_") || key.startsWith("sk_live_") || key.startsWith("rk_");
  }

  /**
   * Converts Mercato integer currency units to Stripe API amounts.
   *
   * Official Stripe Documentation Reference:
   * URL: https://docs.stripe.com/currencies
   * Section: "Zero-decimal currencies" & "Minimum and maximum charge amounts"
   *
   * Official Statement:
   * "All API requests expect amounts to be provided in a currency’s smallest unit.
   * For example, to charge 10 USD, provide an amount value of 1000 (that is, 1000 cents)."
   *
   * Under Zero-decimal currencies:
   * Stripe explicitly lists zero-decimal currencies:
   * BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, UGX, VND, VUV, XAF, XOF, XPF.
   * IDR (Indonesian Rupiah) is NOT listed among zero-decimal currencies.
   *
   * Under Minimum and maximum charge amounts:
   * "For non-card payment methods, the amount value supports up to 12 digits for IDR
   * (for example, a value of 999999999999 for 9,999,999,999.99 IDR)."
   * "Minimum charge amount is equivalent to 0.50 IDR" (i.e. integer value 50 in API).
   *
   * Because Mercato represents IDR as whole Rupiah (e.g. 150000 = Rp 150.000)
   * while Stripe expects two decimal places for IDR, we multiply by 100 when
   * communicating with Stripe, and divide by 100 when receiving amounts from Stripe.
   */
  toStripeAmount(amountMinor: number, currency: string): number {
    const cur = currency.toUpperCase();
    if (cur === "IDR") {
      return amountMinor * 100;
    }
    return amountMinor;
  }

  /**
   * Converts Stripe API amounts back to Mercato integer currency units.
   */
  fromStripeAmount(stripeAmount: number, currency: string): number {
    const cur = currency.toUpperCase();
    if (cur === "IDR") {
      return Math.round(stripeAmount / 100);
    }
    return stripeAmount;
  }

  async createPaymentSession(order: Order, items: OrderItem[]): Promise<PaymentSessionResult> {
    if (!this.isAvailable()) {
      throw new Error("Stripe payment provider is not configured. Secret key is missing.");
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const currency = order.currency.toLowerCase();

    // Map items to Stripe Checkout line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
      price_data: {
        currency,
        product_data: {
          name: item.productName,
          description: item.variantTitle,
        },
        unit_amount: this.toStripeAmount(item.unitPrice, order.currency),
      },
      quantity: item.quantity,
    }));

    if (order.shippingAmount > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: `Shipping (${order.shippingCarrier} - ${order.shippingService})`,
          },
          unit_amount: this.toStripeAmount(order.shippingAmount, order.currency),
        },
        quantity: 1,
      });
    }

    if (order.discountAmount > 0) {
      // In Stripe Checkout, negative line items are rejected; coupons or discounts apply via discounts parameter
      // For precision snapshotting in Mercato, pass discount as an explicit credit item or coupon if needed
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: "Promotional Discount",
          },
          unit_amount: -this.toStripeAmount(order.discountAmount, order.currency),
        },
        quantity: 1,
      });
    }

    const session = await this.client.checkout.sessions.create({
      mode: "payment",
      customer_email: order.guestEmail ?? undefined,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
      },
      line_items: lineItems,
      success_url: `${appUrl}/id/checkout/success?orderNumber=${order.orderNumber}&token=${order.guestAccessToken}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/id/checkout/failed?orderNumber=${order.orderNumber}&token=${order.guestAccessToken}`,
      expires_at: Math.floor(Date.now() / 1000) + 15 * 60, // 15-minute TTL aligned with reservation
    });

    return {
      provider: "stripe",
      providerSessionId: session.id,
      redirectUrl: session.url ?? undefined,
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  async verifyWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: string,
  ): Promise<WebhookVerificationResult> {
    if (!this.isAvailable()) {
      return {
        valid: false,
        provider: "stripe",
        providerEventId: "",
        orderNumber: "",
        eventType: "unknown",
        status: "awaiting_payment",
        amountMinor: 0,
        currency: "IDR",
        rawPayload: payload,
        error: "Stripe secret key is not configured.",
      };
    }

    const signature = headers["stripe-signature"];
    if (!signature || !rawBody) {
      return {
        valid: false,
        provider: "stripe",
        providerEventId: "",
        orderNumber: "",
        eventType: "unknown",
        status: "awaiting_payment",
        amountMinor: 0,
        currency: "IDR",
        rawPayload: payload,
        error: "Missing stripe-signature header or raw body.",
      };
    }

    const sigString = Array.isArray(signature) ? signature[0] : signature;
    if (!sigString) {
      return {
        valid: false,
        provider: "stripe",
        providerEventId: "",
        orderNumber: "",
        eventType: "unknown",
        status: "awaiting_payment",
        amountMinor: 0,
        currency: "IDR",
        rawPayload: payload,
        error: "Missing stripe-signature header.",
      };
    }

    let event: Stripe.Event;

    try {
      event = this.client.webhooks.constructEvent(rawBody, sigString, this.webhookSecret);
    } catch (err) {
      return {
        valid: false,
        provider: "stripe",
        providerEventId: `stripe-err-${Date.now()}`,
        orderNumber: "",
        eventType: "unknown",
        status: "awaiting_payment",
        amountMinor: 0,
        currency: "IDR",
        rawPayload: payload,
        error: err instanceof Error ? err.message : "Invalid Stripe signature",
      };
    }

    let orderNumber = "";
    let status: OrderStatus = "awaiting_payment";
    let amountMinor = 0;
    let currency = "IDR";
    let paymentTransactionId: string | undefined;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      orderNumber = session.metadata?.orderNumber ?? "";
      status = "paid";
      currency = (session.currency ?? "idr").toUpperCase();
      amountMinor = this.fromStripeAmount(session.amount_total ?? 0, currency);
      paymentTransactionId = (session.payment_intent as string) ?? session.id;
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      orderNumber = session.metadata?.orderNumber ?? "";
      status = "cancelled";
      currency = (session.currency ?? "idr").toUpperCase();
      amountMinor = this.fromStripeAmount(session.amount_total ?? 0, currency);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      currency = charge.currency.toUpperCase();
      amountMinor = this.fromStripeAmount(charge.amount_refunded ?? 0, currency);
      status = "refunded";
      paymentTransactionId = charge.id;
    }

    return {
      valid: true,
      provider: "stripe",
      providerEventId: event.id,
      orderNumber,
      eventType: event.type,
      status,
      amountMinor,
      currency,
      paymentTransactionId,
      rawPayload: event,
    };
  }

  async getPaymentStatus(orderNumber: string): Promise<PaymentStatusResult> {
    if (!this.isAvailable()) {
      throw new Error("Stripe secret key is not configured.");
    }

    const sessions = await this.client.checkout.sessions.list({
      limit: 5,
    });

    const session = sessions.data.find((s) => s.metadata?.orderNumber === orderNumber);
    if (!session) {
      throw new Error(`Stripe checkout session not found for order ${orderNumber}`);
    }

    const currency = (session.currency ?? "idr").toUpperCase();
    const amountMinor = this.fromStripeAmount(session.amount_total ?? 0, currency);

    let status: OrderStatus = "awaiting_payment";
    if (session.payment_status === "paid") {
      status = "paid";
    } else if (session.status === "expired") {
      status = "cancelled";
    }

    return {
      status,
      amountMinor,
      currency,
      paymentTransactionId: (session.payment_intent as string) ?? session.id,
    };
  }

  async processRefund(params: {
    order: Order;
    amountMinor: number;
    reason?: string;
  }): Promise<RefundResult> {
    if (!this.isAvailable()) {
      throw new Error("Stripe secret key is not configured.");
    }

    if (!params.order.paymentTransactionId) {
      return {
        success: false,
        amountMinor: params.amountMinor,
        currency: params.order.currency,
        error: "Cannot process Stripe refund: order has no paymentTransactionId",
      };
    }

    const stripeAmount = this.toStripeAmount(params.amountMinor, params.order.currency);

    const refund = await this.client.refunds.create({
      payment_intent: params.order.paymentTransactionId,
      amount: stripeAmount,
      reason: "requested_by_customer",
    });

    return {
      success: true,
      providerRefundId: refund.id,
      amountMinor: params.amountMinor,
      currency: params.order.currency,
    };
  }
}

export const stripePaymentProvider = new StripePaymentProvider();
