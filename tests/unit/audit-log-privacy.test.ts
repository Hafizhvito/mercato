import { describe, expect, it } from "vitest";
import { sanitizeAuditDetails } from "@/server/audit-log";

describe("Audit Log Privacy & Sanitization Guard", () => {
  it("removes passwords, secret keys, tokens, and API credentials from details", () => {
    const rawDetails = {
      orderNumber: "MRC-123456",
      adminPassword: "test-password",
      apiToken: "test-token",
      serverKey: "test-key",
      providerSecret: "test-secret",
      status: "paid",
    };

    const sanitized = sanitizeAuditDetails(rawDetails);

    expect(sanitized).toHaveProperty("orderNumber", "MRC-123456");
    expect(sanitized).toHaveProperty("status", "paid");
    expect(sanitized).not.toHaveProperty("adminPassword");
    expect(sanitized).not.toHaveProperty("apiToken");
    expect(sanitized).not.toHaveProperty("serverKey");
    expect(sanitized).not.toHaveProperty("providerSecret");
  });

  it("masks phone numbers when present in details", () => {
    const rawDetails = {
      customerName: "Budi Santoso",
      phone: "081234567890",
      recipientPhone: "081987654321",
    };

    const sanitized = sanitizeAuditDetails(rawDetails);

    expect(sanitized.phone).toBe("0812****7890");
    expect(sanitized.recipientPhone).toBe("0819****4321");
  });

  it("omits full street address fields from audit details", () => {
    const rawDetails = {
      orderId: "ord-1",
      street: "Jl. Sudirman No. 45 RT 02 / RW 05",
      address: "Kompleks Perumahan Griya Asri Blok B3",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
    };

    const sanitized = sanitizeAuditDetails(rawDetails);

    expect(sanitized).toHaveProperty("city", "Jakarta Selatan");
    expect(sanitized).toHaveProperty("province", "DKI Jakarta");
    expect(sanitized).not.toHaveProperty("street");
    expect(sanitized).not.toHaveProperty("address");
  });

  it("handles null and undefined details gracefully", () => {
    expect(sanitizeAuditDetails(null)).toEqual({});
    expect(sanitizeAuditDetails(undefined)).toEqual({});
  });
});
