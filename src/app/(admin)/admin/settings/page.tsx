import { desc, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hasPermission, type UserRole } from "@/server/guards";
import { EmailTemplatesPreview } from "./EmailTemplatesPreview";
import { PaymentProvidersStatus } from "./PaymentProvidersStatus";
import { StaffManagementTab } from "./StaffManagementTab";
import { StoreInfoForm } from "./StoreInfoForm";
import { TwoFactorEnrollmentCard } from "./TwoFactorEnrollmentCard";

export default async function AdminSettingsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/settings");
  }

  if (!hasPermission(session.user.role, "settings:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk mengakses menu pengaturan toko. Hubungi Admin atau Owner.
      </div>
    );
  }

  const [store] = await db.select().from(schema.stores).limit(1);
  if (!store) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        Toko belum diinisialisasi.
      </div>
    );
  }

  const canManageStaff = hasPermission(session.user.role, "staff:manage");

  // Fetch staff accounts
  const staffList = await db
    .select()
    .from(schema.user)
    .where(inArray(schema.user.role, ["owner", "admin", "staff"]))
    .orderBy(desc(schema.user.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          Pengaturan Toko (Settings)
        </h1>
        <p className="text-sm text-zinc-600">
          Kelola profil toko, tarif pengiriman, pajak, gateway pembayaran, akun staf, dan keamanan.
        </p>
      </div>

      {/* Store Profile & Shipping & Tax */}
      <StoreInfoForm store={store} />

      {/* Payment Gateway Status */}
      <PaymentProvidersStatus />

      {/* Transactional Email Templates Preview */}
      <EmailTemplatesPreview />

      {/* Staff & Team Accounts Management */}
      <StaffManagementTab
        currentUserId={session.user.id}
        currentUserRole={session.user.role as UserRole}
        staffList={staffList}
        canManageStaff={canManageStaff}
      />

      {/* 2FA Security Enrollment */}
      <TwoFactorEnrollmentCard userEmail={session.user.email} />
    </div>
  );
}
