"use client";

import { AlertTriangle, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { createMoney, formatMoney } from "@/lib/money";
import { removeCartItemAction, updateCartItemQuantityAction } from "@/modules/cart/actions";
import type { DetailedCart } from "@/modules/cart/service";

interface Props {
  initialCart: DetailedCart;
  locale: string;
}

export function CartView({ initialCart, locale }: Props) {
  const t = useTranslations("cart");
  const [cart, setCart] = useState(initialCart);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleQuantityChange(cartItemId: string, newQuantity: number) {
    if (newQuantity <= 0) {
      handleRemoveItem(cartItemId);
      return;
    }

    startTransition(async () => {
      await updateCartItemQuantityAction({ cartItemId, quantity: newQuantity });
      setCart((prev) => {
        const updatedItems = prev.items.map((item) => {
          if (item.id === cartItemId) {
            return {
              ...item,
              quantity: newQuantity,
              lineTotal: item.unitPrice * newQuantity,
            };
          }
          return item;
        });

        const newSubtotal = updatedItems.reduce((acc, i) => acc + i.lineTotal, 0);
        const newTotalQty = updatedItems.reduce((acc, i) => acc + i.quantity, 0);

        return {
          ...prev,
          items: updatedItems,
          subtotal: newSubtotal,
          totalQuantity: newTotalQty,
        };
      });
      router.refresh();
    });
  }

  function handleRemoveItem(cartItemId: string) {
    startTransition(async () => {
      await removeCartItemAction({ cartItemId });
      setCart((prev) => {
        const updatedItems = prev.items.filter((item) => item.id !== cartItemId);
        const newSubtotal = updatedItems.reduce((acc, i) => acc + i.lineTotal, 0);
        const newTotalQty = updatedItems.reduce((acc, i) => acc + i.quantity, 0);

        return {
          ...prev,
          items: updatedItems,
          subtotal: newSubtotal,
          totalQuantity: newTotalQty,
        };
      });
      router.refresh();
    });
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">{t("empty")}</h2>
        <div className="mt-8">
          <Link
            href={`/${locale}/catalog`}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
          >
            {t("startShopping")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-6">{t("title")}</h1>

      {/* Capped Quantity Notifications */}
      {cart.cappedItems && cart.cappedItems.length > 0 && (
        <div className="mb-6 space-y-2">
          {cart.cappedItems.map((capped) => (
            <div
              key={`${capped.name}-${capped.reason}-${capped.cappedQuantity}`}
              className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-center gap-3 text-xs text-amber-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {capped.reason === "MAX_ORDER_LIMIT"
                  ? `${capped.name}: ${t("maxQuantityCapped")}`
                  : `${capped.name}: ${t("stockLimited", { stock: capped.cappedQuantity })}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Price Changes Notifications */}
      {cart.priceChanges && cart.priceChanges.length > 0 && (
        <div className="mb-6 space-y-2">
          {cart.priceChanges.map((change) => (
            <div
              key={`${change.name}-${change.oldPrice}-${change.newPrice}`}
              className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 flex items-center gap-3 text-xs text-blue-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-blue-600" />
              <span>
                {change.name}: Price updated from{" "}
                {formatMoney(createMoney(change.oldPrice, cart.currency))} to{" "}
                {formatMoney(createMoney(change.newPrice, cart.currency))}.
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Removed Items Notifications */}
      {cart.removedItems && cart.removedItems.length > 0 && (
        <div className="mb-6 space-y-2">
          {cart.removedItems.map((removed) => (
            <div
              key={`${removed.name}-${removed.reason}`}
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-center gap-3 text-xs text-red-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{removed.name}: Removed because it is no longer available.</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cart Item Rows */}
        <div className="lg:col-span-8 divide-y divide-zinc-200 border-t border-b border-zinc-200">
          {cart.items.map((item) => (
            <div key={item.id} className="py-6 flex gap-4 sm:gap-6">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 relative">
                {item.imageUrl ? (
                  <SafeImage
                    src={item.imageUrl}
                    fallbackSrc="/images/placeholder.svg"
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-zinc-400">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-zinc-900">{item.name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {item.variantTitle} {item.sku ? `• ${item.sku}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isPending}
                      className="text-zinc-400 hover:text-red-600 transition p-1"
                      title={t("remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm font-medium text-zinc-900 mt-2">
                    {formatMoney(createMoney(item.unitPrice, cart.currency))}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4">
                  {/* Quantity Controls */}
                  <div className="flex items-center rounded-lg border border-zinc-200 bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={isPending || item.quantity <= 1}
                      className="p-1.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-semibold text-zinc-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={
                        isPending || item.quantity >= 10 || item.quantity >= item.availableStock
                      }
                      className="p-1.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <span className="text-sm font-bold text-zinc-900">
                    {formatMoney(createMoney(item.lineTotal, cart.currency))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Subtotal / Checkout Column */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sticky top-24">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">{t("subtotal")}</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>{t("subtotal")}</span>
                <span className="font-semibold text-zinc-900">
                  {formatMoney(createMoney(cart.subtotal, cart.currency))}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Shipping rates and promotional discounts are calculated during checkout.
              </p>
            </div>

            <Link
              href={`/${locale}/checkout`}
              className="mt-6 block w-full rounded-xl bg-zinc-900 py-3 text-center text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
            >
              {t("proceedToCheckout")}
            </Link>

            <Link
              href={`/${locale}/catalog`}
              className="mt-3 block text-center text-xs text-zinc-500 hover:text-zinc-900 transition"
            >
              {t("continueShopping")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
