import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleIntl = createMiddleware(routing);
const adminLocalizedRegex = new RegExp(`^/(?:${routing.locales.join("|")})/admin(/.*)?$`);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Intercept any localized admin access (/en/admin/* or /id/admin/*) and redirect to unlocalized back-office console
  const match = pathname.match(adminLocalizedRegex);
  if (match) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = `/admin${match[1] || ""}`;
    return NextResponse.redirect(redirectUrl, 307);
  }

  // Bypass next-intl completely for direct merchant admin paths
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  return handleIntl(req);
}

export default proxy;

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
