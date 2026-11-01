import { describe, expect, it } from "vitest";
import { hasPermission } from "@/server/guards";

describe("Discounts Administrative Permissions", () => {
  it("strictly bars staff from viewing or managing discounts", () => {
    expect(hasPermission("staff", "discounts:view")).toBe(false);
    expect(hasPermission("staff", "discounts:manage")).toBe(false);
  });

  it("strictly bars customer from viewing or managing discounts", () => {
    expect(hasPermission("customer", "discounts:view")).toBe(false);
    expect(hasPermission("customer", "discounts:manage")).toBe(false);
  });

  it("grants admin and owner full discount management permissions", () => {
    for (const role of ["admin", "owner"] as const) {
      expect(hasPermission(role, "discounts:view")).toBe(true);
      expect(hasPermission(role, "discounts:manage")).toBe(true);
    }
  });
});
