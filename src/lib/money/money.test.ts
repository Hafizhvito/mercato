import { describe, expect, it } from "vitest";
import {
  addMoney,
  allocateMoney,
  createMoney,
  formatMoney,
  getCurrencyDecimals,
  multiplyMoney,
  subtractMoney,
} from "./index";

describe("Money utility", () => {
  it("determines correct decimal precision per currency", () => {
    expect(getCurrencyDecimals("IDR")).toBe(0);
    expect(getCurrencyDecimals("JPY")).toBe(0);
    expect(getCurrencyDecimals("USD")).toBe(2);
    expect(getCurrencyDecimals("EUR")).toBe(2);
  });

  it("creates valid money representations in minor units", () => {
    const idr = createMoney(150000, "IDR");
    expect(idr).toEqual({ amount: 150000, currency: "IDR" });

    const usd = createMoney(1999, "USD");
    expect(usd).toEqual({ amount: 1999, currency: "USD" });
  });

  it("rejects non-integer money amounts to prevent floating-point drift", () => {
    expect(() => createMoney(19.99, "USD")).toThrow(TypeError);
  });

  it("adds money with the same currency", () => {
    const a = createMoney(50000, "IDR");
    const b = createMoney(25000, "IDR");
    expect(addMoney(a, b)).toEqual({ amount: 75000, currency: "IDR" });
  });

  it("throws when adding different currencies", () => {
    const idr = createMoney(50000, "IDR");
    const usd = createMoney(500, "USD");
    expect(() => addMoney(idr, usd)).toThrow(Error);
  });

  it("subtracts money with the same currency", () => {
    const a = createMoney(50000, "IDR");
    const b = createMoney(15000, "IDR");
    expect(subtractMoney(a, b)).toEqual({ amount: 35000, currency: "IDR" });
  });

  it("multiplies money by a factor with rounding", () => {
    const price = createMoney(1000, "USD"); // $10.00
    const tax = multiplyMoney(price, 0.11); // 11% tax = 110 minor units
    expect(tax).toEqual({ amount: 110, currency: "USD" });
  });

  it("allocates money proportionally without losing remainder cents", () => {
    const total = createMoney(100, "USD"); // $1.00 split 3 ways
    const parts = allocateMoney(total, [1, 1, 1]);
    expect(parts).toHaveLength(3);
    const sum = parts.reduce((acc, p) => acc + p.amount, 0);
    expect(sum).toBe(100);
    expect(parts[0]?.amount).toBe(34);
    expect(parts[1]?.amount).toBe(33);
    expect(parts[2]?.amount).toBe(33);
  });

  it("formats IDR correctly without decimals", () => {
    const formatted = formatMoney(createMoney(150000, "IDR"), "id-ID");
    // Normalizes non-breaking spaces for cross-platform test matching
    expect(formatted.replace(/\s/g, " ")).toContain("150.000");
  });

  it("formats USD correctly with 2 decimals", () => {
    const formatted = formatMoney(createMoney(2550, "USD"), "en-US");
    expect(formatted).toBe("$25.50");
  });
});
