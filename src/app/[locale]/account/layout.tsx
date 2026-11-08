import { MapPin, Package, User } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StorefrontHeader } from "@/components/storefront/Header";
import { auth } from "@/lib/auth";

export const instant = false;

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AccountLayout({ children, params }: Props) {
  const { locale } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/account`);
  }

  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <StorefrontHeader locale={locale} />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
        <div className="space-y-6">
          {/* Header Title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t("title")}</h1>
            <p className="text-xs text-zinc-600 mt-0.5">{t("subtitle")}</p>
          </div>

          {/* Account Sub-navigation Tabs */}
          <nav className="flex items-center gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold">
            <Link
              href={`/${locale}/account`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition"
            >
              <User className="h-3.5 w-3.5" />
              {t("profileTab")}
            </Link>
            <Link
              href={`/${locale}/account/addresses`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition"
            >
              <MapPin className="h-3.5 w-3.5" />
              {t("addressesTab")}
            </Link>
            <Link
              href={`/${locale}/account/orders`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition"
            >
              <Package className="h-3.5 w-3.5" />
              {t("ordersTab")}
            </Link>
          </nav>

          {/* Tab Content */}
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
