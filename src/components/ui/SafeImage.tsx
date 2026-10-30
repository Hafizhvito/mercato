"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { isAllowedHostname } from "@/lib/media/image-hosts";

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

  // Absolute URLs: parse host and verify against configured single source of truth
  try {
    const parsed = new URL(trimmed);
    return isAllowedHostname(parsed.hostname);
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
