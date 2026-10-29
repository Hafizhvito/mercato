import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authRateLimiter } from "@/lib/cache/ratelimit";

const handlers = toNextJsHandler(auth.handler);

export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Rate limit sensitive auth actions: sign-in, sign-up, reset-password
  if (
    pathname.includes("/sign-in") ||
    pathname.includes("/sign-up") ||
    pathname.includes("/reset-password") ||
    pathname.includes("/forget-password")
  ) {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    try {
      const { success } = await authRateLimiter.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Too many authentication requests. Please try again later." },
          { status: 429 },
        );
      }
    } catch {
      // Degrade gracefully if rate limiting backend is unreachable in isolated testing
    }
  }

  return handlers.POST(req);
}

export const GET = handlers.GET;
