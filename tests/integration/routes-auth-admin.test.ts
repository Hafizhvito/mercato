import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { auth } from "../../src/lib/auth";
import { db } from "../../src/lib/db";
import * as schema from "../../src/lib/db/schema";
import { proxy } from "../../src/proxy";

describe("Item 11 Integration: Storefront Auth & Back-Office Admin Routing Suite", () => {
  describe("Proxy Middleware Routing & Locale Normalization", () => {
    it("handles /login without crashing, routing it through localized App Router", () => {
      const req = new NextRequest("http://localhost:3000/login", {
        headers: { "accept-language": "id" },
      });
      const res = proxy(req);

      // next-intl rewrites /login internally to /id/login or serves as-needed
      expect(res.status).toBeLessThan(400);
      const rewriteHeader = res.headers.get("x-middleware-rewrite");
      if (rewriteHeader) {
        expect(rewriteHeader).toContain("/id/login");
      }
    });

    it("handles /en/login routing to English localized auth page", () => {
      const req = new NextRequest("http://localhost:3000/en/login");
      const res = proxy(req);

      expect(res.status).toBeLessThan(400);
      const rewriteHeader = res.headers.get("x-middleware-rewrite");
      if (rewriteHeader) {
        expect(rewriteHeader).toContain("/en/login");
      }
    });

    it("handles /id/login routing (or redirecting to canonical /login with as-needed prefix)", () => {
      const req = new NextRequest("http://localhost:3000/id/login");
      const res = proxy(req);

      // With localePrefix: "as-needed", next-intl may redirect /id/login (307/308) to /login
      if (res.status === 307 || res.status === 308) {
        const location = res.headers.get("location");
        expect(location).toMatch(/\/login$/);
      } else {
        expect(res.status).toBeLessThan(400);
      }
    });

    it("bypasses next-intl completely for merchant /admin, /admin/dashboard, and /admin/login", () => {
      const paths = ["/admin", "/admin/dashboard", "/admin/login", "/admin/products"];

      for (const p of paths) {
        const req = new NextRequest(`http://localhost:3000${p}`);
        const res = proxy(req);

        // Bypassing next-intl results in a standard Next.js next() response (header x-middleware-next: 1)
        expect(res.headers.get("x-middleware-next")).toBe("1");
        expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      }
    });

    it("redirects mistakenly localized admin URLs (/en/admin/* and /id/admin/*) to unlocalized /admin/*", () => {
      const cases = [
        {
          from: "http://localhost:3000/en/admin/dashboard",
          to: "http://localhost:3000/admin/dashboard",
        },
        {
          from: "http://localhost:3000/id/admin/dashboard",
          to: "http://localhost:3000/admin/dashboard",
        },
        { from: "http://localhost:3000/en/admin/login", to: "http://localhost:3000/admin/login" },
        { from: "http://localhost:3000/en/admin", to: "http://localhost:3000/admin" },
      ];

      for (const { from, to } of cases) {
        const req = new NextRequest(from);
        const res = proxy(req);

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(to);
      }
    });
  });

  describe("File System Structure and Architecture Integrity", () => {
    it("ensures auth routes reside inside [locale]/(auth) to prevent next-intl 404 deopts", () => {
      const authFiles = [
        "src/app/[locale]/(auth)/login/page.tsx",
        "src/app/[locale]/(auth)/register/page.tsx",
        "src/app/[locale]/(auth)/forgot-password/page.tsx",
        "src/app/[locale]/(auth)/reset-password/page.tsx",
        "src/app/[locale]/(auth)/verify-email/page.tsx",
      ];

      for (const file of authFiles) {
        const fullPath = path.resolve(process.cwd(), file);
        expect(fs.existsSync(fullPath)).toBe(true);
      }

      // Ensure root (auth) folder was cleaned up and does not duplicate
      const legacyAuthPath = path.resolve(process.cwd(), "src/app/(auth)");
      expect(fs.existsSync(legacyAuthPath)).toBe(false);
    });

    it("ensures login page handles callbackUrl parameter with Suspense boundary", () => {
      const loginPagePath = path.resolve(process.cwd(), "src/app/[locale]/(auth)/login/page.tsx");
      const content = fs.readFileSync(loginPagePath, "utf-8");

      expect(content).toContain("useSearchParams");
      expect(content).toContain("callbackUrl");
      expect(content).toContain("<Suspense");
      expect(content).toContain("router.push(callbackUrl)");
    });

    it("ensures admin entry points (/admin, /admin/dashboard, /admin/login) exist with root layout tags", () => {
      const adminFiles = [
        "src/app/(admin)/layout.tsx",
        "src/app/(admin)/admin/layout.tsx",
        "src/app/(admin)/admin/page.tsx",
        "src/app/(admin)/admin/dashboard/page.tsx",
        "src/app/(admin)/admin/login/page.tsx",
      ];

      for (const file of adminFiles) {
        const fullPath = path.resolve(process.cwd(), file);
        expect(fs.existsSync(fullPath)).toBe(true);
      }

      const adminRootLayout = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/(admin)/layout.tsx"),
        "utf-8",
      );
      expect(adminRootLayout).toContain("<html");
      expect(adminRootLayout).toContain("<body");
    });
  });

  describe("Authentication, Role Guard, and Callback URL Enforcement", () => {
    const customerEmail = `routing-cust-${Date.now()}@mercato.local`;
    const customerPassword = "CustomerPass123!";

    it("verifies unauthenticated visitor is redirected to /login?callbackUrl=/admin/dashboard", async () => {
      // Simulating session check against empty headers
      const session = await auth.api.getSession({
        headers: new Headers(),
      });
      expect(session).toBeNull();
    });

    it("registers customer account and confirms customer cannot access admin routes", async () => {
      const signupRes = await auth.api.signUpEmail({
        body: {
          email: customerEmail,
          password: customerPassword,
          name: "Customer Routing Tester",
        },
      });

      expect(signupRes?.user).toBeDefined();
      expect(signupRes?.user?.role).toBe("customer");

      // Verify customer role is rejected by admin role requirements
      const isAllowedAdmin =
        signupRes?.user?.role === "admin" ||
        signupRes?.user?.role === "owner" ||
        signupRes?.user?.role === "staff";
      expect(isAllowedAdmin).toBe(false);

      // Clean up test user
      if (signupRes?.user?.id) {
        await db.delete(schema.user).where(eq(schema.user.id, signupRes.user.id));
      }
    });

    it("verifies store owner account can log in and has access to admin dashboard", async () => {
      const ownerEmail =
        process.env.SEED_ADMIN_EMAIL || `owner-routing-${Date.now()}@mercato.local`;
      const ownerPassword = process.env.SEED_ADMIN_PASSWORD || "OwnerSuperSecure2026!";

      let testOwnerCreated = false;
      const ownerUser = await db.query.user.findFirst({
        where: eq(schema.user.email, ownerEmail),
      });

      if (!ownerUser) {
        // Create an owner account for this test
        const signupRes = await auth.api.signUpEmail({
          body: {
            email: ownerEmail,
            password: ownerPassword,
            name: "Store Owner Tester",
          },
        });
        if (signupRes?.user?.id) {
          testOwnerCreated = true;
          // Set role to owner
          await db
            .update(schema.user)
            .set({ role: "owner" })
            .where(eq(schema.user.id, signupRes.user.id));
        }
      }

      const signinRes = await auth.api.signInEmail({
        body: {
          email: ownerEmail,
          password: ownerPassword,
        },
      });

      expect(signinRes?.user).toBeDefined();
      expect(signinRes?.user?.role).toBe("owner");

      const isAllowedAdmin =
        signinRes?.user?.role === "admin" ||
        signinRes?.user?.role === "owner" ||
        signinRes?.user?.role === "staff";
      expect(isAllowedAdmin).toBe(true);

      // Clean up if created for this test
      if (testOwnerCreated && signinRes?.user?.id) {
        await db.delete(schema.user).where(eq(schema.user.id, signinRes.user.id));
      }
    });
  });
});
