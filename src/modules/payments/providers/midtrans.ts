import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { Order, OrderItem, OrderStatus } from "@/modules/orders/schema";
import type {
  PaymentProvider,
  PaymentSessionResult,
  PaymentStatusResult,
  RefundResult,
  WebhookVerificationResult,
} from "../types";

export class MidtransPaymentProvider implements PaymentProvider {
  name = "midtrans" as const;

  private get serverKey(): string {
    return process.env.MIDTRANS_SERVER_KEY ?? env.MIDTRANS_SERVER_KEY ?? "";
  }

  private get isProduction(): boolean {
    return env.MIDTRANS_IS_PRODUCTION === "true";
  }

  private get snapBaseUrl(): string {
    return this.isProduction
      ? "https://app.midtrans.com/snap/v1"
      : "https://app.sandbox.midtrans.com/snap/v1";
  }

  private get apiBaseUrl(): string {
    return this.isProduction
      ? "https://api.midtrans.com/v2"
      : "https://api.sandbox.midtrans.com/v2";
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.serverKey}:`).toString("base64")}`;
  }

  isAvailable(): boolean {
    return Boolean(this.serverKey && this.serverKey.trim().length > 0);
  }

  async createPaymentSession(order: Order, items: OrderItem[]): Promise<PaymentSessionResult> {
    if (!this.isAvailable()) {
      throw new Error("Midtrans payment provider is not configured. Server key is missing.");
    }

    const payload = {
      transaction_details: {
        order_id: order.orderNumber,
        gross_amount: order.totalAmount,
      },
      customer_details: {
        first_name: order.shippingAddress.recipientName,
        email: order.guestEmail ?? "customer@mercato.local",
        phone: order.shippingAddress.phone,
      },
      item_details: [
        ...items.map((i) => ({
          id: i.variantId,
          price: i.unitPrice,
          quantity: i.quantity,
          name: i.productName.slice(0, 50),
        })),
        ...(order.shippingAmount > 0
          ? [
              {
                id: "SHIPPING",
                price: order.shippingAmount,
                quantity: 1,
                name: `Shipping (${order.shippingCarrier})`,
              },
            ]
          : []),
        ...(order.discountAmount > 0
          ? [
              {
                id: "DISCOUNT",
                price: -order.discountAmount,
                quantity: 1,
                name: "Discount Coupon",
              },
            ]
          : []),
      ],
      expiry: {
        duration: 15,
        unit: "minute",
      },
      callbacks: {
        finish: `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/id/checkout/success?orderNumber=${order.orderNumber}&token=${order.guestAccessToken}`,
        error: `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/id/checkout/failed?orderNumber=${order.orderNumber}&token=${order.guestAccessToken}`,
        pending: `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/id/checkout/pending?orderNumber=${order.orderNumber}&token=${order.guestAccessToken}`,
      },
    };

    const res = await fetch(`${this.snapBaseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Midtrans Snap transaction creation failed: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as { token: string; redirect_url: string };

    return {
      provider: "midtrans",
      providerSessionId: data.token,
      clientToken: data.token,
      redirectUrl: data.redirect_url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async verifyWebhook(
    payload: unknown,
    _headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookVerificationResult> {
    if (!this.isAvailable()) {
      return {
        valid: false,
        provider: "midtrans",
        providerEventId: "",
        orderNumber: "",
        eventType: "unknown",
        status: "awaiting_payment",
        amountMinor: 0,
        currency: "IDR",
        rawPayload: payload,
        error: "Midtrans server key is not configured.",
      };
    }

    const body = payload as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
      fraud_status?: string;
      transaction_id?: string;
      currency?: string;
      transaction_time?: string;
    };

    if (!body.order_id || !body.status_code || !body.gross_amount || !body.signature_key) {
      return {
        valid: false,
        provider: "midtrans",
        providerEventId: body.transaction_id ?? "",
        orderNumber: body.order_id ?? "",
        eventType: body.transaction_status ?? "unknown",
        status: "awaiting_payment",
        amountMinor: 0,
        currency: "IDR",
        rawPayload: payload,
        error: "Missing mandatory signature fields in Midtrans payload.",
      };
    }

    // Verify SHA-512 Signature Hash
    const rawSignatureString = `${body.order_id}${body.status_code}${body.gross_amount}${this.serverKey}`;
    const expectedSignature = crypto.createHash("sha512").update(rawSignatureString).digest("hex");

    if (body.signature_key !== expectedSignature) {
      return {
        valid: false,
        provider: "midtrans",
        providerEventId: body.transaction_id ?? `midtrans-evt-${Date.now()}`,
        orderNumber: body.order_id,
        eventType: body.transaction_status ?? "unknown",
        status: "awaiting_payment",
        amountMinor: Math.round(Number(body.gross_amount)),
        currency: body.currency ?? "IDR",
        rawPayload: payload,
        error: "Cryptographic signature mismatch.",
      };
    }

    const amountMinor = Math.round(Number(body.gross_amount));
    const status = this.mapStatus(body.transaction_status ?? "", body.fraud_status);

    return {
      valid: true,
      provider: "midtrans",
      providerEventId:
        body.transaction_id ?? `midtrans-evt-${body.order_id}-${body.transaction_status}`,
      orderNumber: body.order_id,
      eventType: body.transaction_status ?? "notification",
      status,
      amountMinor,
      currency: body.currency ?? "IDR",
      paymentTransactionId: body.transaction_id,
      fraudStatus: body.fraud_status,
      rawPayload: payload,
    };
  }

  async getPaymentStatus(orderNumber: string): Promise<PaymentStatusResult> {
    if (!this.isAvailable()) {
      throw new Error("Midtrans server key is not configured.");
    }

    const res = await fetch(`${this.apiBaseUrl}/${orderNumber}/status`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: this.authHeader,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Midtrans status check failed: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as {
      transaction_status: string;
      fraud_status?: string;
      gross_amount: string;
      currency?: string;
      transaction_id?: string;
      settlement_time?: string;
    };

    return {
      status: this.mapStatus(data.transaction_status, data.fraud_status),
      amountMinor: Math.round(Number(data.gross_amount)),
      currency: data.currency ?? "IDR",
      paymentTransactionId: data.transaction_id,
      settledAt: data.settlement_time ? new Date(data.settlement_time) : undefined,
    };
  }

  async processRefund(params: {
    order: Order;
    amountMinor: number;
    reason?: string;
  }): Promise<RefundResult> {
    if (!this.isAvailable()) {
      throw new Error("Midtrans server key is not configured.");
    }

    const res = await fetch(`${this.apiBaseUrl}/${params.order.orderNumber}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify({
        refund_key: `ref-${params.order.id}-${Date.now()}`,
        amount: params.amountMinor,
        reason: params.reason ?? "Customer requested refund",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        success: false,
        amountMinor: params.amountMinor,
        currency: params.order.currency,
        error: `Midtrans refund request failed: ${res.status} ${err}`,
      };
    }

    const data = (await res.json()) as { refund_id?: string; id?: string };

    return {
      success: true,
      providerRefundId: data.refund_id ?? data.id ?? `midtrans-ref-${Date.now()}`,
      amountMinor: params.amountMinor,
      currency: params.order.currency,
    };
  }

  private mapStatus(transactionStatus: string, fraudStatus?: string): OrderStatus {
    if (transactionStatus === "capture") {
      return fraudStatus === "challenge" ? "awaiting_payment" : "paid";
    }
    if (transactionStatus === "settlement") {
      return "paid";
    }
    if (transactionStatus === "pending") {
      return "awaiting_payment";
    }
    if (["deny", "cancel", "expire"].includes(transactionStatus)) {
      return "cancelled";
    }
    if (transactionStatus === "refund" || transactionStatus === "partial_refund") {
      return "refunded";
    }
    return "awaiting_payment";
  }
}

export const midtransPaymentProvider = new MidtransPaymentProvider();
