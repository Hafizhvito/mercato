import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskPhone } from "@/lib/mask";

export interface LogAuditOptions {
  storeId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * Sanitizes audit log metadata to strictly guarantee that no PII
 * (unmasked phone numbers, full street addresses) or secrets (passwords, tokens, API keys)
 * are ever persisted in audit_logs.details.
 */
export function sanitizeAuditDetails(
  details?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!details) return {};
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();

    // Redact secret keys, tokens, and passwords completely
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("apikey") ||
      (lowerKey.includes("key") && (lowerKey.includes("server") || lowerKey.includes("private")))
    ) {
      continue;
    }

    // Mask phone numbers if present
    if (lowerKey.includes("phone") && typeof val === "string") {
      sanitized[key] = maskPhone(val);
      continue;
    }

    // Prohibit full street address strings
    if (lowerKey === "street" || lowerKey === "address" || lowerKey === "fulladdress") {
      continue;
    }

    sanitized[key] = val;
  }

  return sanitized;
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
