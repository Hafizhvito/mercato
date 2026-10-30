import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/storefront/CheckoutView";
import { Header } from "@/components/storefront/Header";
import { getCartAction } from "@/modules/cart/actions";
import { getProvincesAction } from "@/modules/shipping/actions";

export const metadata: Metadata = {
  title: "Checkout | Mercato",
  description: "Complete your order securely on Mercato.",
};

export const instant = false;

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cart = await getCartAction();

  if (cart.items.length === 0) {
    redirect(`/${locale}/cart`);
  }

  const provinces = await getProvincesAction();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <CheckoutView cart={cart} provinces={provinces} locale={locale} />
      </main>
    </div>
  );
}
