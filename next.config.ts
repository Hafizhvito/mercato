import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { ALLOWED_IMAGE_REMOTE_PATTERNS } from "./src/lib/media/image-hosts";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ["image/avif", "image/webp"],
    remotePatterns: ALLOWED_IMAGE_REMOTE_PATTERNS.map((pattern) => ({
      protocol: pattern.protocol,
      hostname: pattern.hostname,
      port: pattern.port,
      pathname: pattern.pathname,
    })),
  },
};

export default withNextIntl(nextConfig);
