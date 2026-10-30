import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleIntl = createMiddleware(routing);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Intercept any localized admin access and redirect to the unlocalized merchant admin console
  if (
    pathname === "/en/admin" ||
    pathname.startsWith("/en/admin/") ||
    pathname === "/id/admin" ||
    pathname.startsWith("/id/admin/")
  ) {
    const unlocalizedPath = pathname.replace(/^\/(?:en|id)/, "");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = unlocalizedPath;
    return NextResponse.redirect(redirectUrl, 307);
  }

  // Bypass next-intl completely for direct admin paths
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  return handleIntl(req);
}

export default proxy;

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
