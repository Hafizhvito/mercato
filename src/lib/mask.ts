/**
 * Data masking utilities for privacy preservation across UI and audit representations.
 */

/**
 * Masks a phone number so only the first 4 and last 4 characters remain visible,
 * e.g. "081234567890" -> "0812****7890".
 * Handles shorter inputs gracefully.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "****";
  if (cleaned.length < 8) {
    return `${cleaned.slice(0, 2)}****${cleaned.slice(-2)}`;
  }
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
}

/**
 * Masks an email address for privacy, e.g. "customer@example.com" -> "c***r@example.com".
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "****";

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
