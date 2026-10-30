import type { Metadata } from "next";
import { CartView } from "@/components/storefront/CartView";
import { Header } from "@/components/storefront/Header";
import { getCartAction } from "@/modules/cart/actions";

export const metadata: Metadata = {
  title: "Shopping Cart | Mercato",
  description: "View and manage items in your Mercato shopping cart.",
};

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cart = await getCartAction();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <CartView initialCart={cart} locale={locale} />
      </main>
    </div>
  );
}
