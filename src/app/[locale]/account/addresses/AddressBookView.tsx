"use client";

import { AlertCircle, Edit2, Loader2, MapPin, Plus, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CustomerAddress } from "@/lib/db/schema";
import {
  deleteCustomerAddressAction,
  saveCustomerAddressAction,
  setDefaultCustomerAddressAction,
} from "@/modules/customers/actions";
import {
  getDistrictsAction,
  getProvincesAction,
  getRegenciesAction,
} from "@/modules/shipping/actions";

interface RegionOption {
  code: string;
  name: string;
}

interface Labels {
  addressesTab: string;
  addressesDesc: string;
  noAddresses: string;
  addAddress: string;
  editAddress: string;
  deleteAddress: string;
  setDefault: string;
  defaultBadge: string;
  selectedAddressBadge: string;
  recipientName: string;
  phone: string;
  phonePlaceholder: string;
  street: string;
  streetPlaceholder: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  postalCodePlaceholder: string;
  loadingRegions: string;
  selectProvince: string;
  selectCity: string;
  selectDistrict: string;
  makeDefaultCheckbox: string;
  cancel: string;
  saveAddress: string;
  incompleteRegionError: string;
  saveAddressFailed: string;
  deleteAddressConfirm: string;
  deleteAddressFailed: string;
  setDefaultFailed: string;
}

interface Props {
  initialAddresses: CustomerAddress[];
  labels: Labels;
}

export function AddressBookView({ initialAddresses, labels }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  // Form State
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cascading Regions
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [regencies, setRegencies] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedProvinceName, setSelectedProvinceName] = useState("");
  const [selectedRegencyCode, setSelectedRegencyCode] = useState("");
  const [selectedRegencyName, setSelectedRegencyName] = useState("");
  const [selectedDistrictName, setSelectedDistrictName] = useState("");

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Load provinces on modal open
  useEffect(() => {
    if (modalOpen) {
      setLoadingProvinces(true);
      getProvincesAction()
        .then((data) => setProvinces(data))
        .catch(() => {})
        .finally(() => setLoadingProvinces(false));
    }
  }, [modalOpen]);

  // When province changes, load regencies
  const handleProvinceChange = async (provCode: string) => {
    setSelectedProvinceCode(provCode);
    const provObj = provinces.find((p) => p.code === provCode);
    setSelectedProvinceName(provObj?.name || "");

    setSelectedRegencyCode("");
    setSelectedRegencyName("");
    setRegencies([]);
    setDistricts([]);
    setSelectedDistrictName("");
    setPostalCode("");

    if (!provCode) return;
    setLoadingRegencies(true);
    try {
      const data = await getRegenciesAction(provCode);
      setRegencies(data);
    } finally {
      setLoadingRegencies(false);
    }
  };

  // When regency changes, load districts
  const handleRegencyChange = async (regCode: string) => {
    setSelectedRegencyCode(regCode);
    const regObj = regencies.find((r) => r.code === regCode);
    setSelectedRegencyName(regObj?.name || "");

    setDistricts([]);
    setSelectedDistrictName("");
    setPostalCode("");

    if (!regCode) return;
    setLoadingDistricts(true);
    try {
      const data = await getDistrictsAction(regCode);
      setDistricts(data);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setRecipientName("");
    setPhone("");
    setStreet("");
    setPostalCode("");
    setIsDefault(initialAddresses.length === 0);
    setSelectedProvinceCode("");
    setSelectedProvinceName("");
    setSelectedRegencyCode("");
    setSelectedRegencyName("");
    setSelectedDistrictName("");
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = async (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setRecipientName(addr.recipientName);
    setPhone(addr.phone);
    setStreet(addr.street);
    setPostalCode(addr.postalCode);
    setIsDefault(addr.isDefault);
    setSelectedProvinceName(addr.province);
    setSelectedRegencyName(addr.city);
    setSelectedDistrictName(addr.district);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const prov = selectedProvinceName || editingAddress?.province;
    const cit = selectedRegencyName || editingAddress?.city;
    const dist = selectedDistrictName || editingAddress?.district;

    if (!prov || !cit || !dist) {
      setError(labels.incompleteRegionError);
      return;
    }

    startTransition(async () => {
      try {
        await saveCustomerAddressAction({
          id: editingAddress?.id,
          recipientName,
          phone,
          street,
          province: prov,
          city: cit,
          district: dist,
          postalCode,
          isDefault,
        });
        setModalOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.saveAddressFailed);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm(labels.deleteAddressConfirm)) return;
    startTransition(async () => {
      try {
        await deleteCustomerAddressAction(id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : labels.deleteAddressFailed);
      }
    });
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      try {
        await setDefaultCustomerAddressAction(id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : labels.setDefaultFailed);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-950">{labels.addressesTab}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{labels.addressesDesc}</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 py-2 px-3 text-xs font-semibold text-white hover:bg-zinc-800 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          {labels.addAddress}
        </button>
      </div>

      {initialAddresses.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-zinc-400 space-y-3">
          <MapPin className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="text-xs">{labels.noAddresses}</p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {labels.addAddress}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialAddresses.map((addr) => (
            <div
              key={addr.id}
              className={`rounded-xl border p-5 bg-white shadow-xs space-y-3 relative flex flex-col justify-between ${
                addr.isDefault ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-zinc-200"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-950 text-sm">{addr.recipientName}</span>
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                      {labels.defaultBadge}
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-zinc-500">{addr.phone}</div>
                <div className="text-xs text-zinc-700 leading-relaxed pt-1">
                  <p>{addr.street}</p>
                  <p className="text-zinc-500">
                    {addr.district}, {addr.city}
                  </p>
                  <p className="text-zinc-500">
                    {addr.province} {addr.postalCode}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                {!addr.isDefault ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-zinc-600 hover:text-zinc-950 font-medium"
                  >
                    {labels.setDefault}
                  </button>
                ) : (
                  <span className="text-[11px] text-zinc-400">{labels.selectedAddressBadge}</span>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(addr)}
                    className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-950 font-medium"
                  >
                    <Edit2 className="h-3 w-3" />
                    {labels.editAddress}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(addr.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
                  >
                    <Trash2 className="h-3 w-3" />
                    {labels.deleteAddress}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">
                {editingAddress ? labels.editAddress : labels.addAddress}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="addr-recipient-name"
                    className="block font-semibold text-zinc-700 mb-1"
                  >
                    {labels.recipientName}
                  </label>
                  <input
                    id="addr-recipient-name"
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label htmlFor="addr-phone" className="block font-semibold text-zinc-700 mb-1">
                    {labels.phone}
                  </label>
                  <input
                    id="addr-phone"
                    type="tel"
                    required
                    placeholder={labels.phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="addr-street" className="block font-semibold text-zinc-700 mb-1">
                  {labels.street}
                </label>
                <textarea
                  id="addr-street"
                  rows={2}
                  required
                  placeholder={labels.streetPlaceholder}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              {/* Cascading Dropdowns */}
              <div>
                <label htmlFor="addr-province" className="block font-semibold text-zinc-700 mb-1">
                  {labels.province} {loadingProvinces && labels.loadingRegions}
                </label>
                <select
                  id="addr-province"
                  value={selectedProvinceCode}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
                >
                  <option value="">
                    {editingAddress?.province ? editingAddress.province : labels.selectProvince}
                  </option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="addr-city" className="block font-semibold text-zinc-700 mb-1">
                    {labels.city} {loadingRegencies && labels.loadingRegions}
                  </label>
                  <select
                    id="addr-city"
                    disabled={regencies.length === 0 && !editingAddress}
                    value={selectedRegencyCode}
                    onChange={(e) => handleRegencyChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white disabled:bg-zinc-100"
                  >
                    <option value="">
                      {editingAddress?.city ? editingAddress.city : labels.selectCity}
                    </option>
                    {regencies.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="addr-district" className="block font-semibold text-zinc-700 mb-1">
                    {labels.district} {loadingDistricts && labels.loadingRegions}
                  </label>
                  <select
                    id="addr-district"
                    disabled={districts.length === 0 && !editingAddress}
                    value={selectedDistrictName}
                    onChange={(e) => {
                      setSelectedDistrictName(e.target.value);
                      setPostalCode("");
                    }}
                    className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white disabled:bg-zinc-100"
                  >
                    <option value="">
                      {editingAddress?.district ? editingAddress.district : labels.selectDistrict}
                    </option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="addr-postal-code"
                  className="block font-semibold text-zinc-700 mb-1"
                >
                  {labels.postalCode}
                </label>
                <input
                  id="addr-postal-code"
                  type="text"
                  required
                  placeholder={labels.postalCodePlaceholder}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <span className="text-zinc-700">{labels.makeDefaultCheckbox}</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                >
                  {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {labels.saveAddress}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
