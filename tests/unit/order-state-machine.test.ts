import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/modules/orders/schema";
import { canTransitionOrder, validateOrderTransition } from "@/modules/orders/state-machine";

describe("Order State Machine Unit Tests", () => {
  it("allows self-transition as no-op", () => {
    expect(canTransitionOrder("pending", "pending")).toBe(true);
    expect(canTransitionOrder("paid", "paid")).toBe(true);
    expect(() => validateOrderTransition("shipped", "shipped")).not.toThrow();
  });

  it("permits standard order fulfillment lifecycle progression", () => {
    expect(canTransitionOrder("pending", "awaiting_payment")).toBe(true);
    expect(canTransitionOrder("awaiting_payment", "paid")).toBe(true);
    expect(canTransitionOrder("paid", "processing")).toBe(true);
    expect(canTransitionOrder("processing", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
  });

  it("permits cancellation from pre-delivery states", () => {
    expect(canTransitionOrder("pending", "cancelled")).toBe(true);
    expect(canTransitionOrder("awaiting_payment", "cancelled")).toBe(true);
    expect(canTransitionOrder("paid", "cancelled")).toBe(true);
    expect(canTransitionOrder("processing", "cancelled")).toBe(true);
  });

  it("permits refunds only after payment has been received", () => {
    expect(canTransitionOrder("pending", "refunded")).toBe(false);
    expect(canTransitionOrder("awaiting_payment", "refunded")).toBe(false);
    expect(canTransitionOrder("paid", "refunded")).toBe(true);
    expect(canTransitionOrder("processing", "refunded")).toBe(true);
    expect(canTransitionOrder("shipped", "refunded")).toBe(true);
    expect(canTransitionOrder("delivered", "refunded")).toBe(true);
  });

  it("strictly prohibits transitions from terminal states", () => {
    const allStatuses: OrderStatus[] = [
      "pending",
      "awaiting_payment",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ];

    for (const status of allStatuses) {
      if (status !== "cancelled") {
        expect(canTransitionOrder("cancelled", status)).toBe(false);
        expect(() => validateOrderTransition("cancelled", status)).toThrow(
          /Illegal order state transition/,
        );
      }
      if (status !== "refunded") {
        expect(canTransitionOrder("refunded", status)).toBe(false);
        expect(() => validateOrderTransition("refunded", status)).toThrow(
          /Illegal order state transition/,
        );
      }
    }
  });

  it("strictly prohibits backwards jumps or skipping required payment steps", () => {
    expect(canTransitionOrder("awaiting_payment", "shipped")).toBe(false);
    expect(canTransitionOrder("delivered", "processing")).toBe(false);
    expect(canTransitionOrder("shipped", "awaiting_payment")).toBe(false);
  });
});
