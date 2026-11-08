import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { AddressBookView } from "./AddressBookView";

export const instant = false;

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountAddressesPage({ params }: Props) {
  const { locale } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  const addresses = session?.user?.id
    ? await db
        .select()
        .from(schema.customerAddresses)
        .where(eq(schema.customerAddresses.customerId, session.user.id))
        .orderBy(desc(schema.customerAddresses.isDefault), desc(schema.customerAddresses.createdAt))
    : [];

  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
      <AddressBookView
        initialAddresses={addresses}
        labels={{
          addressesTab: t("addressesTab"),
          addressesDesc: t("addressesDesc"),
          noAddresses: t("noAddresses"),
          addAddress: t("addAddress"),
          editAddress: t("editAddress"),
          deleteAddress: t("deleteAddress"),
          setDefault: t("setDefault"),
          defaultBadge: t("defaultBadge"),
          selectedAddressBadge: t("selectedAddressBadge"),
          recipientName: t("recipientName"),
          phone: t("phone"),
          phonePlaceholder: t("phonePlaceholder"),
          street: t("street"),
          streetPlaceholder: t("streetPlaceholder"),
          province: t("province"),
          city: t("city"),
          district: t("district"),
          postalCode: t("postalCode"),
          postalCodePlaceholder: t("postalCodePlaceholder"),
          loadingRegions: t("loadingRegions"),
          selectProvince: t("selectProvince"),
          selectCity: t("selectCity"),
          selectDistrict: t("selectDistrict"),
          makeDefaultCheckbox: t("makeDefaultCheckbox"),
          cancel: t("cancel"),
          saveAddress: t("saveAddress"),
          incompleteRegionError: t("incompleteRegionError"),
          saveAddressFailed: t("saveAddressFailed"),
          deleteAddressConfirm: t("deleteAddressConfirm"),
          deleteAddressFailed: t("deleteAddressFailed"),
          setDefaultFailed: t("setDefaultFailed"),
        }}
      />
    </div>
  );
}
