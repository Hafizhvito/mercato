import { describe, expect, it } from "vitest";
import { canTransitionOrder, validateOrderTransition } from "@/modules/orders/state-machine";
import { hasPermission } from "@/server/guards";

describe("Admin Orders & Fulfillment State Machine", () => {
  it("allows standard fulfillment flow: paid -> processing -> shipped -> delivered", () => {
    expect(canTransitionOrder("paid", "processing")).toBe(true);
    expect(canTransitionOrder("processing", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
  });

  it("prohibits backwards transitions from delivered or shipped back to pending/paid", () => {
    expect(canTransitionOrder("delivered", "paid")).toBe(false);
    expect(canTransitionOrder("delivered", "processing")).toBe(false);
    expect(canTransitionOrder("shipped", "awaiting_payment")).toBe(false);
  });

  it("validates that unpaid orders can transition to cancelled", () => {
    expect(canTransitionOrder("pending", "cancelled")).toBe(true);
    expect(canTransitionOrder("awaiting_payment", "cancelled")).toBe(true);
  });

  it("throws on illegal transitions using validateOrderTransition", () => {
    expect(() => validateOrderTransition("delivered", "pending")).toThrow(
      'Illegal order state transition from "delivered" to "pending"',
    );
  });
});

describe("Admin Orders Permissions", () => {
  it("grants staff orders:view, orders:fulfill, orders:notes, and orders:cancel_unpaid", () => {
    expect(hasPermission("staff", "orders:view")).toBe(true);
    expect(hasPermission("staff", "orders:fulfill")).toBe(true);
    expect(hasPermission("staff", "orders:notes")).toBe(true);
    expect(hasPermission("staff", "orders:cancel_unpaid")).toBe(true);
  });

  it("strictly bars staff from orders:refund and orders:export", () => {
    expect(hasPermission("staff", "orders:refund")).toBe(false);
    expect(hasPermission("staff", "orders:export")).toBe(false);
  });

  it("grants admin and owner all orders permissions including refund and export", () => {
    for (const role of ["admin", "owner"] as const) {
      expect(hasPermission(role, "orders:view")).toBe(true);
      expect(hasPermission(role, "orders:fulfill")).toBe(true);
      expect(hasPermission(role, "orders:notes")).toBe(true);
      expect(hasPermission(role, "orders:cancel_unpaid")).toBe(true);
      expect(hasPermission(role, "orders:refund")).toBe(true);
      expect(hasPermission(role, "orders:export")).toBe(true);
    }
  });

  it("bars customer role from all back-office orders operations", () => {
    expect(hasPermission("customer", "orders:view")).toBe(false);
    expect(hasPermission("customer", "orders:fulfill")).toBe(false);
    expect(hasPermission("customer", "orders:notes")).toBe(false);
    expect(hasPermission("customer", "orders:cancel_unpaid")).toBe(false);
    expect(hasPermission("customer", "orders:refund")).toBe(false);
    expect(hasPermission("customer", "orders:export")).toBe(false);
  });
});
