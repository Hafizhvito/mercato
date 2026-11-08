import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "@/lib/mask";

describe("maskPhone", () => {
  it("masks standard Indonesian 12-digit phone number with first and last 4 digits visible", () => {
    expect(maskPhone("081234567890")).toBe("0812****7890");
  });

  it("masks 10-digit phone number", () => {
    expect(maskPhone("0812345678")).toBe("0812****5678");
  });

  it("handles short numbers gracefully", () => {
    expect(maskPhone("1234")).toBe("****");
    expect(maskPhone("123456")).toBe("12****56");
  });

  it("handles empty or null inputs", () => {
    expect(maskPhone(null)).toBe("");
    expect(maskPhone(undefined)).toBe("");
    expect(maskPhone("")).toBe("");
  });
});

describe("maskEmail", () => {
  it("masks standard email", () => {
    expect(maskEmail("customer@example.com")).toBe("c***r@example.com");
  });

  it("masks short local part", () => {
    expect(maskEmail("me@domain.com")).toBe("m***@domain.com");
  });

  it("handles invalid or null emails", () => {
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("invalid")).toBe("****");
  });
});
