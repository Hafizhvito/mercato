"use client";

import { AlertCircle, Check, ChevronLeft, Loader2, Tag, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createMoney, formatMoney } from "@/lib/money";
import type { DetailedCart } from "@/modules/cart/service";
import {
  calculateShippingRatesAction,
  submitCheckoutAction,
  validateDiscountCodeAction,
} from "@/modules/orders/actions";
import { getDistrictsAction, getRegenciesAction } from "@/modules/shipping/actions";
import type { Address, ShippingRate } from "@/modules/shipping/types";

interface ProvinceOption {
  code: string;
  name: string;
}

interface RegencyOption {
  code: string;
  name: string;
}

interface DistrictOption {
  code: string;
  name: string;
}

interface Props {
  cart: DetailedCart;
  provinces: ProvinceOption[];
  locale: string;
}

export function CheckoutView({ cart, provinces, locale }: Props) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Address State
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedRegencyCode, setSelectedRegencyCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Cascading options loaded asynchronously
  const [regencies, setRegencies] = useState<RegencyOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

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

  async function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const provCode = e.target.value;
    setSelectedProvinceCode(provCode);
    setSelectedRegencyCode("");
    setSelectedDistrictCode("");
    setPostalCode(""); // Reset postal code on region change
    setShippingRates([]);
    setSelectedRate(null);
    setDistricts([]);

    if (provCode) {
      setLoadingRegencies(true);
      try {
        const data = await getRegenciesAction(provCode);
        setRegencies(data);
      } catch {
        setError("Failed to load cities/regencies");
      } finally {
        setLoadingRegencies(false);
      }
    } else {
      setRegencies([]);
    }
  }

  async function handleRegencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const regCode = e.target.value;
    setSelectedRegencyCode(regCode);
    setSelectedDistrictCode("");
    setPostalCode(""); // Reset postal code on region change
    setShippingRates([]);
    setSelectedRate(null);

    if (regCode) {
      setLoadingDistricts(true);
      try {
        const data = await getDistrictsAction(regCode);
        setDistricts(data);
      } catch {
        setError("Failed to load districts");
      } finally {
        setLoadingDistricts(false);
      }
    } else {
      setDistricts([]);
    }
  }

  async function handleDistrictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const distCode = e.target.value;
    setSelectedDistrictCode(distCode);
    setPostalCode(""); // Reset postal code on region change

    const provObj = provinces.find((p) => p.code === selectedProvinceCode);
    const regObj = regencies.find((r) => r.code === selectedRegencyCode);
    const distObj = districts.find((d) => d.code === distCode);

    if (provObj && regObj && distObj) {
      setLoadingShipping(true);
      setError(null);
      try {
        const destAddress: Address = {
          recipientName: recipientName || "Customer",
          phone: phone || "08123456789",
          street: street || "Address Line",
          district: distObj.name,
          city: regObj.name,
          province: provObj.name,
          postalCode: "",
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

    const provObj = provinces.find((p) => p.code === selectedProvinceCode);
    const regObj = regencies.find((r) => r.code === selectedRegencyCode);
    const distObj = districts.find((d) => d.code === selectedDistrictCode);

    if (
      !provObj ||
      !regObj ||
      !distObj ||
      !recipientName.trim() ||
      !phone.trim() ||
      !street.trim()
    ) {
      setError(t("incompleteAddress"));
      return;
    }

    // Strict 5-digit postal code check
    if (!/^\d{5}$/.test(postalCode.trim())) {
      setError(t("invalidPostal"));
      return;
    }

    if (!selectedRate) {
      setError(t("selectShippingRequired"));
      return;
    }

    const shippingAddress: Address = {
      recipientName: recipientName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      district: distObj.name,
      city: regObj.name,
      province: provObj.name,
      postalCode: postalCode.trim(),
      country: "Indonesia",
    };

    startTransition(async () => {
      try {
        const result = await submitCheckoutAction({
          idempotencyKey,
          checkoutSessionId,
          guestEmail: guestEmail.trim() || undefined,
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
          router.push(`/${locale}/orders/${result.orderNumber}?token=${result.guestAccessToken}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout order creation failed");
      }
    });
  }

  // Cost calculations
  const discountAmount = appliedDiscount ? appliedDiscount.amountMinor : 0;
  const shippingCost = selectedRate ? selectedRate.costMinor : 0;
  const totalAmount = Math.max(0, cart.subtotal - discountAmount + shippingCost);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href={`/${locale}/cart`}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 mb-6 transition"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("backToCart")}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-8">{t("title")}</h1>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recipient & Address */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">{t("shippingDetails")}</h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="chk-name"
                  className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                >
                  {t("recipientName")}
                </label>
                <input
                  id="chk-name"
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={t("recipientNamePlaceholder")}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="chk-phone"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    {t("phone")}
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label
                    htmlFor="chk-email"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    {t("email")}
                  </label>
                  <input
                    id="chk-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="chk-street"
                  className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                >
                  {t("street")}
                </label>
                <textarea
                  id="chk-street"
                  required
                  rows={2}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder={t("streetPlaceholder")}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              {/* Cascading Region Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="chk-prov"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    {t("province")}
                  </label>
                  <select
                    id="chk-prov"
                    required
                    value={selectedProvinceCode}
                    onChange={handleProvinceChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  >
                    <option value="">{t("selectProvince")}</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="chk-reg"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    {t("city")}
                  </label>
                  <select
                    id="chk-reg"
                    required
                    disabled={!selectedProvinceCode || loadingRegencies}
                    value={selectedRegencyCode}
                    onChange={handleRegencyChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    <option value="">{loadingRegencies ? "Loading..." : t("selectCity")}</option>
                    {regencies.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="chk-dist"
                    className="block text-xs font-semibold text-zinc-700 uppercase mb-1"
                  >
                    {t("district")}
                  </label>
                  <select
                    id="chk-dist"
                    required
                    disabled={!selectedRegencyCode || loadingDistricts}
                    value={selectedDistrictCode}
                    onChange={handleDistrictChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    <option value="">
                      {loadingDistricts ? "Loading..." : t("selectDistrict")}
                    </option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.code}>
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
                  {t("postalCode")}
                </label>
                <input
                  id="chk-postal"
                  type="text"
                  required
                  maxLength={5}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="10110"
                  className="w-36 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Shipping Method Selector */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {t("shippingMethod")}
            </h2>

            {loadingShipping ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("calculatingShipping")}
              </div>
            ) : shippingRates.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">{t("selectRegionPrompt")}</p>
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
                          <p className="text-sm font-semibold text-zinc-900">
                            {rate.carrier} - {rate.service}
                          </p>
                          <p className="text-xs text-zinc-500">{rate.estimatedDays}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-zinc-900">{formattedCost}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary & Coupon */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">{t("orderSummary")}</h2>

            {/* Cart Items List */}
            <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto mb-6">
              {cart.items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                    <p className="text-xs text-zinc-400">
                      {item.variantTitle} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-semibold text-zinc-900 shrink-0">
                    {formatMoney(createMoney(item.lineTotal, cart.currency))}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon Code Section */}
            <div className="pt-4 border-t border-zinc-100 mb-6">
              <label
                htmlFor="chk-coupon"
                className="block text-xs font-semibold text-zinc-700 uppercase mb-2"
              >
                {t("couponCode")}
              </label>
              <div className="flex gap-2">
                <input
                  id="chk-coupon"
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder={t("couponPlaceholder")}
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs uppercase tracking-wider text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition"
                >
                  {t("apply")}
                </button>
              </div>

              {discountError && <p className="text-xs text-red-600 mt-2">{discountError}</p>}
              {appliedDiscount && (
                <div className="mt-2 flex items-center justify-between text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-md">
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {appliedDiscount.code}
                  </span>
                  <span>
                    -{formatMoney(createMoney(appliedDiscount.amountMinor, cart.currency))}
                  </span>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 border-t border-zinc-100 pt-4 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>{t("subtotal")}</span>
                <span>{formatMoney(createMoney(cart.subtotal, cart.currency))}</span>
              </div>

              {appliedDiscount && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>{t("discount")}</span>
                  <span>
                    -{formatMoney(createMoney(appliedDiscount.amountMinor, cart.currency))}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-zinc-600">
                <span>{t("shipping")}</span>
                <span>
                  {selectedRate
                    ? formatMoney(createMoney(selectedRate.costMinor, cart.currency))
                    : "—"}
                </span>
              </div>

              <div className="flex justify-between font-bold text-base text-zinc-900 pt-2 border-t border-zinc-100">
                <span>{t("total")}</span>
                <span>{formatMoney(createMoney(totalAmount, cart.currency))}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !selectedRate}
              className="mt-6 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("processing")}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t("placeOrder")}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
