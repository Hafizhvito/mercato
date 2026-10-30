import type { Ratelimit } from "@upstash/ratelimit";
import { describe, expect, it, vi } from "vitest";
import { createLimiter, MemoryRateLimiter, UpstashRateLimiter } from "@/lib/cache/ratelimit";

describe("Rate Limiter Unit Tests", () => {
  it("MemoryRateLimiter enforces request limits within sliding window", async () => {
    const limiter = new MemoryRateLimiter(3, 1000);
    const id = "test-user-limit";

    const res1 = await limiter.limit(id);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await limiter.limit(id);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await limiter.limit(id);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);

    const res4 = await limiter.limit(id);
    expect(res4.success).toBe(false);
    expect(res4.remaining).toBe(0);
  });

  it("UpstashRateLimiter adapts underlying Upstash Ratelimit response correctly", async () => {
    const mockRatelimit = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: 1730000000000,
      }),
    } as unknown as Ratelimit;

    const limiter = new UpstashRateLimiter(mockRatelimit);
    const result = await limiter.limit("remote-client-ip");

    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(result.reset).toBe(1730000000000);
    expect(mockRatelimit.limit).toHaveBeenCalledWith("remote-client-ip");
  });

  it("createLimiter throws fatal error in production when Upstash credentials are dummy", () => {
    expect(() => {
      createLimiter(5, "1 m", 60_000, "ratelimit:test", {
        nodeEnv: "production",
        upstashUrl: "https://example-upstash.upstash.io",
      });
    }).toThrow(/Fatal: Production environment requires valid UPSTASH_REDIS_REST_URL/);

    expect(() => {
      createLimiter(5, "1 m", 60_000, "ratelimit:test", {
        nodeEnv: "production",
        upstashUrl: "",
        upstashToken: "",
      });
    }).toThrow(/Fatal: Production environment requires valid UPSTASH_REDIS_REST_URL/);
  });
});
