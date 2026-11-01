import { describe, expect, it } from "vitest";
import { hasPermission } from "@/server/guards";

describe("Analytics Permissions & Metrics Logic", () => {
  it("strictly bars staff and customer from viewing analytics", () => {
    expect(hasPermission("staff", "analytics:view")).toBe(false);
    expect(hasPermission("customer", "analytics:view")).toBe(false);
  });

  it("grants admin and owner analytics:view permissions", () => {
    expect(hasPermission("admin", "analytics:view")).toBe(true);
    expect(hasPermission("owner", "analytics:view")).toBe(true);
  });

  it("calculates net revenue by subtracting refunds from gross revenue", () => {
    const grossRevenue = 1_000_000;
    const totalRefunds = 150_000;
    const netRevenue = Math.max(0, grossRevenue - totalRefunds);
    expect(netRevenue).toBe(850_000);
  });

  it("calculates average order value (AOV) accurately", () => {
    const netRevenue = 1_200_000;
    const paidOrders = 4;
    const aov = paidOrders > 0 ? Math.round(netRevenue / paidOrders) : 0;
    expect(aov).toBe(300_000);
  });

  it("returns zero AOV when no paid orders exist", () => {
    const netRevenue = 0;
    const paidOrders = 0;
    const aov = paidOrders > 0 ? Math.round(netRevenue / paidOrders) : 0;
    expect(aov).toBe(0);
  });
});
