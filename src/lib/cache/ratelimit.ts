import { Ratelimit } from "@upstash/ratelimit";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { env } from "@/lib/env";
import { redis } from "./index";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

export class MemoryRateLimiter implements RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.requests.get(identifier) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0] ?? now;
      const reset = oldest + this.windowMs;
      this.requests.set(identifier, timestamps);
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset,
      };
    }

    timestamps.push(now);
    this.requests.set(identifier, timestamps);
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - timestamps.length,
      reset: now + this.windowMs,
    };
  }

  clear(identifier?: string) {
    if (identifier) {
      this.requests.delete(identifier);
    } else {
      this.requests.clear();
    }
  }
}

export class UpstashRateLimiter implements RateLimiter {
  constructor(private readonly ratelimit: Ratelimit) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const res = await this.ratelimit.limit(identifier);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
    };
  }
}

export function isDummyUpstash(url = env.UPSTASH_REDIS_REST_URL || ""): boolean {
  return !url || url.includes("example-upstash") || url.includes("dummy") || url.includes("fake");
}

export function createLimiter(
  maxRequests: number,
  windowStr: `${number} ${"ms" | "s" | "m" | "h" | "d"}`,
  windowMs: number,
  prefix: string,
  config?: {
    upstashUrl?: string;
    upstashToken?: string;
    nodeEnv?: string;
    nextPhase?: string;
  },
): RateLimiter {
  const nodeEnv = config?.nodeEnv ?? process.env.NODE_ENV;
  const nextPhase = config?.nextPhase ?? process.env.NEXT_PHASE;
  const upstashUrl = config?.upstashUrl ?? env.UPSTASH_REDIS_REST_URL;
  const upstashToken = config?.upstashToken ?? env.UPSTASH_REDIS_REST_TOKEN;

  const isProduction = nodeEnv === "production";
  const isBuildPhase = nextPhase === PHASE_PRODUCTION_BUILD;

  // In production runtime (outside the Next.js production build phase),
  // Upstash credentials MUST be valid. This check does NOT depend on CI or SKIP_ENV_VALIDATION.
  if (isProduction && !isBuildPhase) {
    if (isDummyUpstash(upstashUrl) || !upstashToken) {
      throw new Error(
        "Fatal: Production environment requires valid UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. " +
          "MemoryRateLimiter fallback is strictly prohibited in production runtime.",
      );
    }

    return new UpstashRateLimiter(
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, windowStr),
        analytics: true,
        prefix,
      }),
    );
  }

  if (isDummyUpstash(upstashUrl) || nodeEnv === "test" || isBuildPhase) {
    return new MemoryRateLimiter(maxRequests, windowMs);
  }

  return new UpstashRateLimiter(
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, windowStr),
      analytics: true,
      prefix,
    }),
  );
}

// In-memory or Upstash default instances
const defaultAuthLimiter = createLimiter(5, "1 m", 60_000, "ratelimit:auth");
const defaultCheckoutLimiter = createLimiter(10, "1 m", 60_000, "ratelimit:checkout");
const defaultSearchLimiter = createLimiter(30, "1 m", 60_000, "ratelimit:search");
const defaultUploadLimiter = createLimiter(20, "1 m", 60_000, "ratelimit:upload");

let customAuthRateLimiter: RateLimiter | null = null;
let customCheckoutRateLimiter: RateLimiter | null = null;
let customSearchRateLimiter: RateLimiter | null = null;
let customUploadRateLimiter: RateLimiter | null = null;

export const authRateLimiter: RateLimiter = {
  limit: (id: string) => (customAuthRateLimiter ?? defaultAuthLimiter).limit(id),
};

export const checkoutRateLimiter: RateLimiter = {
  limit: (id: string) => (customCheckoutRateLimiter ?? defaultCheckoutLimiter).limit(id),
};

export const searchRateLimiter: RateLimiter = {
  limit: (id: string) => (customSearchRateLimiter ?? defaultSearchLimiter).limit(id),
};

export const uploadRateLimiter: RateLimiter = {
  limit: (id: string) => (customUploadRateLimiter ?? defaultUploadLimiter).limit(id),
};

export function setAuthRateLimiter(limiter: RateLimiter | null) {
  customAuthRateLimiter = limiter;
}

export function setCheckoutRateLimiter(limiter: RateLimiter | null) {
  customCheckoutRateLimiter = limiter;
}

export function setSearchRateLimiter(limiter: RateLimiter | null) {
  customSearchRateLimiter = limiter;
}

export function setUploadRateLimiter(limiter: RateLimiter | null) {
  customUploadRateLimiter = limiter;
}
