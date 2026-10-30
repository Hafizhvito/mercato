"use client";

import { AlertCircle, Check, Loader2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import type { DetailedCart } from "@/modules/cart/service";
import {
  calculateShippingRatesAction,
  submitCheckoutAction,
  validateDiscountCodeAction,
} from "@/modules/orders/actions";
import {
  type City,
  type District,
  getCitiesByProvince,
  getDistrictsByCity,
  type Province,
} from "@/modules/shipping/data/indonesia-regions";
import type { Address, ShippingRate } from "@/modules/shipping/types";

interface Props {
  cart: DetailedCart;
  provinces: Province[];
  locale: string;
}

export function CheckoutView({ cart, provinces, locale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Address State
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const cities: City[] = selectedProvinceId ? getCitiesByProvince(selectedProvinceId) : [];
  const districts: District[] = selectedCityId ? getDistrictsByCity(selectedCityId) : [];

  // Shipping Rates State
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);

  // Discount State
  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amountMinor: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Client Session & Idempotency Key
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [checkoutSessionId] = useState(() => crypto.randomUUID());

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const provId = e.target.value;
    setSelectedProvinceId(provId);
    setSelectedCityId("");
    setSelectedDistrictId("");
    setPostalCode("");
    setShippingRates([]);
    setSelectedRate(null);
  }

  function handleCityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cityId = e.target.value;
    setSelectedCityId(cityId);
    setSelectedDistrictId("");
    setPostalCode("");
    setShippingRates([]);
    setSelectedRate(null);
  }

  async function handleDistrictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const distId = e.target.value;
    setSelectedDistrictId(distId);

    const foundDistrict = districts.find((d) => d.id === distId);
    const code = foundDistrict?.postalCode ?? "";
    setPostalCode(code);

    const provObj = provinces.find((p) => p.id === selectedProvinceId);
    const cityObj = cities.find((c) => c.id === selectedCityId);

    if (provObj && cityObj && foundDistrict) {
      setLoadingShipping(true);
      setError(null);
      try {
        const destAddress: Address = {
          recipientName: recipientName || "Customer",
          phone: phone || "08123456789",
          street: street || "Address Line",
          district: foundDistrict.name,
          city: cityObj.name,
          province: provObj.name,
          postalCode: code,
          country: "Indonesia",
        };

        const rates = await calculateShippingRatesAction(destAddress, 1000);
        setShippingRates(rates);
        if (rates.length > 0) {
          setSelectedRate(rates[0] ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load shipping rates");
      } finally {
        setLoadingShipping(false);
      }
    }
  }

  async function handleApplyDiscount() {
    if (!couponCode.trim()) return;
    setDiscountError(null);

    try {
      const res = await validateDiscountCodeAction(couponCode.trim(), cart.subtotal);
      if (res.valid) {
        setAppliedDiscount({
          code: couponCode.trim().toUpperCase(),
          amountMinor: res.discountAmountMinor,
        });
      } else {
        setDiscountError(res.reason ?? "Invalid discount code");
      }
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Error validating coupon");
    }
  }

  function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const provObj = provinces.find((p) => p.id === selectedProvinceId);
    const cityObj = cities.find((c) => c.id === selectedCityId);
    const distObj = districts.find((d) => d.id === selectedDistrictId);

    if (!provObj || !cityObj || !distObj || !postalCode) {
      setError("Please complete the destination address selection.");
      return;
    }

    if (!selectedRate) {
      setError("Please select a shipping delivery method.");
      return;
    }

    const shippingAddress: Address = {
      recipientName,
      phone,
      street,
      district: distObj.name,
      city: cityObj.name,
      province: provObj.name,
      postalCode,
      country: "Indonesia",
    };

    startTransition(async () => {
      try {
        const result = await submitCheckoutAction({
          idempotencyKey,
          checkoutSessionId,
          guestEmail: guestEmail || undefined,
          shippingAddress,
          shippingCarrier: selectedRate.carrier,
          shippingService: selectedRate.service,
          shippingAmountMinor: selectedRate.costMinor,
          discountCode: appliedDiscount?.code,
          items: cart.items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          cartId: cart.id,
        });

        if (result.success) {
          router.push(`/${locale}/orders/${result.orderNumber}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout order creation failed");
      }
    });
  }

  const shippingCost = selectedRate?.costMinor ?? 0;
  const discountCost = appliedDiscount?.amountMinor ?? 0;
  const totalAmount = Math.max(0, cart.subtotal - discountCost + shippingCost);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 mb-8">
        {locale === "id" ? "Penyelesaian Pembelian" : "Checkout"}
      </h1>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Left Form Column */}
        <div className="lg:col-span-7 space-y-8">
          {/* Customer & Shipping Address */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">
              {locale === "id" ? "Alamat Pengiriman (Indonesia)" : "Shipping Destination"}
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="chk-email"
                  className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                >
                  Email
                </label>
                <input
                  id="chk-email"
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="orders@customer.local"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="chk-name"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    Recipient Full Name
                  </label>
                  <input
                    id="chk-name"
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Budi Santoso"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label
                    htmlFor="chk-phone"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    Phone Number
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="chk-street"
                  className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                >
                  Street Address
                </label>
                <textarea
                  id="chk-street"
                  required
                  rows={2}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Jl. Merdeka No. 45, RT 02 / RW 05"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              {/* Administrative Region Selectors */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="chk-prov"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    Province
                  </label>
                  <select
                    id="chk-prov"
                    required
                    value={selectedProvinceId}
                    onChange={handleProvinceChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  >
                    <option value="">Select Province</option>
                    {provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="chk-city"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    City / Regency
                  </label>
                  <select
                    id="chk-city"
                    required
                    disabled={!selectedProvinceId}
                    value={selectedCityId}
                    onChange={handleCityChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden disabled:bg-zinc-50"
                  >
                    <option value="">Select City</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="chk-dist"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    District
                  </label>
                  <select
                    id="chk-dist"
                    required
                    disabled={!selectedCityId}
                    value={selectedDistrictId}
                    onChange={handleDistrictChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden disabled:bg-zinc-50"
                  >
                    <option value="">Select District</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="chk-postal"
                  className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                >
                  Postal Code
                </label>
                <input
                  id="chk-postal"
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="10110"
                  className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Shipping Method Selector */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {locale === "id" ? "Metode Pengiriman" : "Shipping Method"}
            </h2>

            {loadingShipping ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating courier shipping rates...
              </div>
            ) : shippingRates.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">
                Select your province, city, and district above to view courier delivery options.
              </p>
            ) : (
              <div className="space-y-3">
                {shippingRates.map((rate) => {
                  const isSelected = selectedRate?.id === rate.id;
                  const formattedCost = formatMoney(createMoney(rate.costMinor, cart.currency));

                  return (
                    <label
                      key={rate.id}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-50/75"
                          : "border-zinc-200 hover:bg-zinc-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingRate"
                          checked={isSelected}
                          onChange={() => setSelectedRate(rate)}
                          className="text-zinc-900 focus:ring-zinc-900"
                        />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{rate.title}</p>
                          <p className="text-xs text-zinc-400">Estimated {rate.estimatedDays}</p>
                        </div>
                      </div>
                      <span className="font-bold text-zinc-900 text-sm">{formattedCost}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Summary Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sticky top-24 space-y-6">
            <h2 className="text-lg font-bold text-zinc-950">
              {locale === "id" ? "Ringkasan Pesanan" : "Order Summary"}
            </h2>

            {/* Line Items Snapshot */}
            <div className="divide-y divide-zinc-200 max-h-60 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.name}</p>
                    <p className="text-zinc-500">
                      {item.variantTitle} x {item.quantity}
                    </p>
                  </div>
                  <span className="font-medium text-zinc-900">
                    {formatMoney(createMoney(item.lineTotal, cart.currency))}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon Discount Form */}
            <div className="border-t border-zinc-200 pt-4">
              <label
                htmlFor="chk-coupon"
                className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
              >
                Coupon / Discount Code
              </label>
              <div className="flex gap-2">
                <input
                  id="chk-coupon"
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="e.g. HEMAT10"
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs uppercase text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition"
                >
                  Apply
                </button>
              </div>
              {appliedDiscount && (
                <div className="mt-2 text-xs font-medium text-emerald-700 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  Code {appliedDiscount.code} applied (-
                  {formatMoney(createMoney(appliedDiscount.amountMinor, cart.currency))})
                </div>
              )}
              {discountError && <p className="mt-2 text-xs text-rose-600">{discountError}</p>}
            </div>

            {/* Price Calculations */}
            <div className="border-t border-zinc-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-900">
                  {formatMoney(createMoney(cart.subtotal, cart.currency))}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Shipping</span>
                <span className="font-semibold text-zinc-900">
                  {selectedRate ? formatMoney(createMoney(shippingCost, cart.currency)) : "Rp 0"}
                </span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount ({appliedDiscount.code})</span>
                  <span>-{formatMoney(createMoney(discountCost, cart.currency))}</span>
                </div>
              )}
              <div className="border-t border-zinc-200 pt-3 flex justify-between font-bold text-base text-zinc-950">
                <span>Total Amount</span>
                <span>{formatMoney(createMoney(totalAmount, cart.currency))}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !selectedRate}
              className="w-full flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-4 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing Order...
                </div>
              ) : locale === "id" ? (
                "Pesan Sekarang"
              ) : (
                "Place Order"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
