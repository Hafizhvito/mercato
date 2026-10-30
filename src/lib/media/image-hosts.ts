/**
 * Single source of truth for permitted remote image hosts.
 * Shared between next.config.ts (Next.js remotePatterns) and SafeImage.tsx.
 */

export interface ImageRemotePattern {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
}

export const ALLOWED_IMAGE_REMOTE_PATTERNS: readonly ImageRemotePattern[] = [
  {
    protocol: "https",
    hostname: "**.r2.cloudflarestorage.com",
  },
  {
    protocol: "https",
    hostname: "**.r2.dev",
  },
  {
    protocol: "https",
    hostname: "assets.mercato.local",
  },
  {
    protocol: "http",
    hostname: "localhost",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
  },
];

/**
 * Checks whether a given hostname matches any allowed remote pattern.
 * Supports Next.js wildcard patterns (** and *).
 */
export function isAllowedHostname(
  hostname: string,
  patterns: readonly ImageRemotePattern[] = ALLOWED_IMAGE_REMOTE_PATTERNS,
): boolean {
  const normalizedHost = hostname.toLowerCase().trim();

  return patterns.some((p) => {
    const patternHost = p.hostname.toLowerCase();

    if (patternHost.startsWith("**.")) {
      const suffix = patternHost.slice(3);
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
    }

    if (patternHost.startsWith("*.")) {
      const suffix = patternHost.slice(2);
      const dotIndex = normalizedHost.indexOf(".");
      return dotIndex !== -1 && normalizedHost.slice(dotIndex + 1) === suffix;
    }

    return normalizedHost === patternHost;
  });
}
