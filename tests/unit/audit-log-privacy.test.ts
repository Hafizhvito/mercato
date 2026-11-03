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

  it("masks emails and phone numbers across nested structures", () => {
    const rawDetails = {
      customer: {
        name: "Siti Rahma",
        email: "customer.test@example.com",
        phone: "081234567890",
      },
    };

    const sanitized = sanitizeAuditDetails(rawDetails) as {
      customer: { name: string; email: string; phone: string };
    };

    expect(sanitized.customer.name).toBe("Siti Rahma");
    expect(sanitized.customer.email).toBe("c***t@example.com");
    expect(sanitized.customer.phone).toBe("0812****7890");
  });

  it("recursively sanitizes before/after diffs, omitting secrets and street addresses while masking PII", () => {
    const rawDiff = {
      action: "customer.profile_updated",
      diff: {
        before: {
          email: "old.email@example.com",
          phone: "081211112222",
          street: "Jl. Sudirman No. 10",
          passwordHash: "test-old-hash",
          city: "Jakarta Pusat",
        },
        after: {
          email: "new.email@example.com",
          phone: "081233334444",
          street: "Jl. Thamrin No. 20",
          passwordHash: "test-new-hash",
          city: "Jakarta Selatan",
        },
      },
    };

    const sanitized = sanitizeAuditDetails(rawDiff) as {
      action: string;
      diff: {
        before: Record<string, unknown>;
        after: Record<string, unknown>;
      };
    };

    expect(sanitized.action).toBe("customer.profile_updated");
    // Verify Before
    expect(sanitized.diff.before.email).toBe("o***l@example.com");
    expect(sanitized.diff.before.phone).toBe("0812****2222");
    expect(sanitized.diff.before.city).toBe("Jakarta Pusat");
    expect(sanitized.diff.before).not.toHaveProperty("street");
    expect(sanitized.diff.before).not.toHaveProperty("passwordHash");

    // Verify After
    expect(sanitized.diff.after.email).toBe("n***l@example.com");
    expect(sanitized.diff.after.phone).toBe("0812****4444");
    expect(sanitized.diff.after.city).toBe("Jakarta Selatan");
    expect(sanitized.diff.after).not.toHaveProperty("street");
    expect(sanitized.diff.after).not.toHaveProperty("passwordHash");
  });

  it("recursively sanitizes arrays of objects", () => {
    const rawArrayDetails = {
      items: [
        {
          name: "Item 1",
          userToken: "test-user-token",
          contactPhone: "081298765432",
        },
        {
          name: "Item 2",
          contactEmail: "item2@example.com",
          street: "Jl. Gatot Subroto",
        },
      ],
    };

    const sanitized = sanitizeAuditDetails(rawArrayDetails) as {
      items: Array<Record<string, unknown>>;
    };

    expect(sanitized.items[0]).toEqual({
      name: "Item 1",
      contactPhone: "0812****5432",
    });
    expect(sanitized.items[1]).toEqual({
      name: "Item 2",
      contactEmail: "i***2@example.com",
    });
  });

  it("handles null and undefined details gracefully", () => {
    expect(sanitizeAuditDetails(null)).toEqual({});
    expect(sanitizeAuditDetails(undefined)).toEqual({});
  });
});
