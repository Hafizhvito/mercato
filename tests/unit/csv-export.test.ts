import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/app/api/admin/orders/export/route";

describe("CSV Export Formula Injection & Escaping Suite", () => {
  it("neutralizes spreadsheet formula injection by prefixing trigger characters with a single quote", () => {
    // Dangerous formula prefixes: =, +, -, @, \t, \r
    expect(escapeCsvCell("=1+1")).toBe('"\'=1+1"');
    expect(escapeCsvCell("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
    expect(escapeCsvCell("+628123456789")).toBe('"\'+628123456789"');
    expect(escapeCsvCell("-15000")).toBe('"\'-15000"');
    expect(escapeCsvCell("@SUM(A1:A100)")).toBe('"\'@SUM(A1:A100)"');
    expect(escapeCsvCell("\tDDE_EXEC")).toBe('"\'\tDDE_EXEC"');
    expect(escapeCsvCell("\rCARRIAGE_RETURN")).toBe('"\'\rCARRIAGE_RETURN"');
  });

  it("neutralizes a customer recipient name beginning with formula triggers like =1+1", () => {
    const maliciousCustomerName = "=1+1";
    const escaped = escapeCsvCell(maliciousCustomerName);
    expect(escaped).toBe('"\'=1+1"');
  });

  it("escapes quotes correctly by doubling them", () => {
    expect(escapeCsvCell('T-Shirt "Vintage" Edition')).toBe('"T-Shirt ""Vintage"" Edition"');
  });

  it("preserves newlines inside quoted cells", () => {
    expect(escapeCsvCell("Jl. Kemang Raya No. 10\nJakarta Selatan")).toBe(
      '"Jl. Kemang Raya No. 10\nJakarta Selatan"',
    );
  });

  it("handles standard text and numbers without modification", () => {
    expect(escapeCsvCell("Normal Customer Name")).toBe('"Normal Customer Name"');
    expect(escapeCsvCell(250000)).toBe('"250000"');
  });

  it("handles null and undefined gracefully as empty strings", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });
});
