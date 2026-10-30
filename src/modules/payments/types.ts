import type { Order, OrderItem, OrderStatus } from "@/modules/orders/schema";

export interface PaymentSessionResult {
  provider: "midtrans" | "stripe";
  providerSessionId: string;
  clientToken?: string;
  redirectUrl?: string;
  expiresAt: Date;
}

export interface WebhookVerificationResult {
  valid: boolean;
  provider: "midtrans" | "stripe";
  providerEventId: string;
  orderNumber: string;
  eventType: string;
  status: OrderStatus;
  amountMinor: number;
  currency: string;
  paymentTransactionId?: string;
  fraudStatus?: string;
  rawPayload: unknown;
  error?: string;
}

export interface PaymentStatusResult {
  status: OrderStatus;
  amountMinor: number;
  currency: string;
  paymentTransactionId?: string;
  settledAt?: Date;
}

export interface RefundResult {
  success: boolean;
  providerRefundId?: string;
  amountMinor: number;
  currency: string;
  error?: string;
}

export interface PaymentProvider {
  name: "midtrans" | "stripe";
  isAvailable(): boolean;
  createPaymentSession(order: Order, items: OrderItem[]): Promise<PaymentSessionResult>;
  verifyWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: string,
  ): Promise<WebhookVerificationResult>;
  getPaymentStatus(orderNumber: string): Promise<PaymentStatusResult>;
  processRefund(params: {
    order: Order;
    amountMinor: number;
    reason?: string;
  }): Promise<RefundResult>;
}
