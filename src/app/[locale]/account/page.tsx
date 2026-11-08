import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";

export const instant = false;

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountProfilePage({ params }: Props) {
  const { locale } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-base font-bold text-zinc-950">{t("profileTab")}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{t("profileDesc")}</p>
      </div>

      <ProfileForm
        initialName={session?.user?.name || ""}
        email={session?.user?.email || ""}
        labels={{
          name: t("name"),
          email: t("email"),
          emailHelpText: t("emailHelpText"),
          saveProfile: t("saveProfile"),
          profileUpdated: t("profileUpdated"),
          profileUpdateFailed: t("profileUpdateFailed"),
        }}
      />
    </div>
  );
}
