"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

const ALLOWED_HOST_PATTERNS = [
  /\.r2\.cloudflarestorage\.com$/,
  /\.r2\.dev$/,
  /^assets\.mercato\.local$/,
  /^localhost$/,
  /^127\.0\.0\.1$/,
];

export function isAllowedImageSrc(src: unknown): boolean {
  if (typeof src !== "string" || !src.trim()) {
    return false;
  }
  const trimmed = src.trim();

  // Local relative static paths are safe
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }

  // Inline data images
  if (trimmed.startsWith("data:image/")) {
    return true;
  }

  // Absolute URLs: parse host and verify against configured whitelist
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

export interface SafeImageProps extends Omit<ImageProps, "src"> {
  src: string | null | undefined;
  fallbackSrc?: string;
}

export const DEFAULT_IMAGE_FALLBACK = "/images/placeholder.svg";

export function SafeImage({
  src,
  fallbackSrc = DEFAULT_IMAGE_FALLBACK,
  alt,
  onError,
  ...rest
}: SafeImageProps) {
  const safeInitialSrc = isAllowedImageSrc(src) && src ? src : fallbackSrc;
  const [imgSrc, setImgSrc] = useState<string>(safeInitialSrc);

  useEffect(() => {
    const nextSrc = isAllowedImageSrc(src) && src ? src : fallbackSrc;
    setImgSrc(nextSrc);
  }, [src, fallbackSrc]);

  return (
    <Image
      {...rest}
      src={imgSrc}
      alt={alt || "Mercato Product"}
      onError={(e) => {
        if (imgSrc !== fallbackSrc) {
          setImgSrc(fallbackSrc);
        }
        onError?.(e);
      }}
    />
  );
}

export default SafeImage;
