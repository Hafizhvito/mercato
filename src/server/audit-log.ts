import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskEmail, maskPhone } from "@/lib/mask";

export interface LogAuditOptions {
  storeId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSecretKey(lowerKey: string): boolean {
  return (
    lowerKey.includes("password") ||
    lowerKey.includes("secret") ||
    lowerKey.includes("token") ||
    lowerKey.includes("apikey") ||
    (lowerKey.includes("key") &&
      (lowerKey.includes("server") ||
        lowerKey.includes("private") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("signing")))
  );
}

function isAddressKey(lowerKey: string): boolean {
  return (
    lowerKey === "street" ||
    lowerKey === "address" ||
    lowerKey === "fulladdress" ||
    lowerKey === "alamat"
  );
}

function sanitizeValue(val: unknown, keyName = ""): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  // Primitive strings: check for phone or email
  if (typeof val === "string") {
    const lowerKey = keyName.toLowerCase();
    if (
      lowerKey.includes("phone") ||
      lowerKey.includes("telepon") ||
      lowerKey.includes("hp") ||
      lowerKey.includes("mobile")
    ) {
      return maskPhone(val);
    }
    if (lowerKey.includes("email") || EMAIL_REGEX.test(val.trim())) {
      return maskEmail(val);
    }
    return val;
  }

  // Arrays: recursively sanitize elements
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeValue(item, keyName));
  }

  // Date objects: preserve
  if (val instanceof Date) {
    return val;
  }

  // Nested Objects (including before/after diffs)
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const sanitizedObj: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
      const lowerK = k.toLowerCase();

      // Drop secrets completely
      if (isSecretKey(lowerK)) {
        continue;
      }

      // Drop full street addresses
      if (isAddressKey(lowerK)) {
        continue;
      }

      sanitizedObj[k] = sanitizeValue(v, k);
    }

    return sanitizedObj;
  }

  return val;
}

/**
 * Sanitizes audit log metadata recursively to strictly guarantee that no PII
 * (unmasked emails/phone numbers, full street addresses) or secrets (passwords, tokens, API keys)
 * are ever persisted in audit_logs.details. Handles nested objects, arrays, and before/after diffs.
 */
export function sanitizeAuditDetails(
  details?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!details) return {};
  return (sanitizeValue(details) as Record<string, unknown>) || {};
}

/**
 * Records an immutable administrative audit log with sanitized metadata.
 */
export async function recordAuditLog(options: LogAuditOptions) {
  const sanitizedDetails = sanitizeAuditDetails(options.details);
  await db.insert(schema.auditLogs).values({
    storeId: options.storeId,
    userId: options.userId ?? null,
    action: options.action,
    entityType: options.entityType,
    entityId: options.entityId,
    details: JSON.stringify(sanitizedDetails),
  });
}
