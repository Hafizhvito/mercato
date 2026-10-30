"use client";

import { AlertTriangle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import { removeCartItemAction, updateCartItemQuantityAction } from "@/modules/cart/actions";
import type { DetailedCart } from "@/modules/cart/service";

interface Props {
  initialCart: DetailedCart;
  locale: string;
}

export function CartView({ initialCart, locale }: Props) {
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
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          {locale === "id" ? "Keranjang Anda Kosong" : "Your Cart is Empty"}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          {locale === "id"
            ? "Jelajahi produk lokal terbaik kami dan tambahkan ke keranjang."
            : "Browse our curated products and add items to your shopping cart."}
        </p>
        <div className="mt-8">
          <Link
            href={`/${locale}/catalog`}
            className="inline-flex rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
          >
            {locale === "id" ? "Mulai Belanja" : "Start Shopping"}
          </Link>
        </div>
      </div>
    );
  }

  const formattedSubtotal = formatMoney(createMoney(cart.subtotal, cart.currency));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 mb-8">
        {locale === "id" ? "Keranjang Belanja" : "Shopping Cart"} ({cart.totalQuantity})
      </h1>

      {/* Price changes and removals notifications */}
      {cart.priceChanges.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4" />
            Notice: Prices updated since added to cart
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {cart.priceChanges.map((change) => (
              <li key={change.name}>
                {change.name}: updated from{" "}
                {formatMoney(createMoney(change.oldPrice, cart.currency))} to{" "}
                {formatMoney(createMoney(change.newPrice, cart.currency))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cart.removedItems.length > 0 && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4" />
            Items removed (no longer available)
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {cart.removedItems.map((item) => (
              <li key={item.name}>
                {item.name} ({item.reason})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Items List */}
        <div className="lg:col-span-8 divide-y divide-zinc-200 border-t border-b border-zinc-200">
          {cart.items.map((item) => {
            const formattedItemPrice = formatMoney(createMoney(item.unitPrice, cart.currency));
            const formattedItemTotal = formatMoney(createMoney(item.lineTotal, cart.currency));

            return (
              <div key={item.id} className="py-6 flex gap-4 sm:gap-6">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-zinc-900">{item.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{item.variantTitle}</p>
                        <p className="text-[11px] text-zinc-400">SKU: {item.sku}</p>
                      </div>
                      <span className="font-bold text-zinc-950">{formattedItemTotal}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">{formattedItemPrice} each</p>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-zinc-200 rounded-lg">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        className="p-1.5 text-zinc-600 hover:text-zinc-950 disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-3 text-xs font-semibold text-zinc-900 min-w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={isPending || item.quantity >= Math.min(10, item.availableStock)}
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="p-1.5 text-zinc-600 hover:text-zinc-950 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemoveItem(item.id)}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary Card */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sticky top-24">
            <h2 className="text-lg font-bold text-zinc-950 mb-4">
              {locale === "id" ? "Ringkasan Pesanan" : "Order Summary"}
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>{locale === "id" ? "Subtotal" : "Subtotal"}</span>
                <span className="font-semibold text-zinc-900">{formattedSubtotal}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>{locale === "id" ? "Pengiriman" : "Shipping"}</span>
                <span className="text-xs text-zinc-400 italic">
                  {locale === "id" ? "Dihitung saat checkout" : "Calculated at checkout"}
                </span>
              </div>
              <div className="border-t border-zinc-200 pt-3 flex justify-between font-bold text-base text-zinc-950">
                <span>{locale === "id" ? "Total Estimasi" : "Estimated Total"}</span>
                <span>{formattedSubtotal}</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href={`/${locale}/checkout`}
                className="w-full flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
              >
                {locale === "id" ? "Lanjut ke Pembayaran" : "Proceed to Checkout"}
              </Link>
            </div>

            <div className="mt-4 text-center">
              <Link
                href={`/${locale}/catalog`}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                {locale === "id" ? "← Lanjut Belanja" : "← Continue Shopping"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
