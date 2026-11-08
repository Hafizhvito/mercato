import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getStaffInviteAction } from "@/modules/settings/actions";
import { AcceptInviteClient } from "./AcceptInviteClient";

export const instant = false;

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl border border-zinc-200 sm:rounded-2xl sm:px-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-950">Tautan Tidak Lengkap</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Token undangan tidak ditemukan. Pastikan Anda membuka tautan lengkap yang diterima di
              email Anda.
            </p>
            <div className="pt-2">
              <Link
                href="/login?callbackUrl=/admin/dashboard"
                className="inline-flex w-full justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
              >
                Kembali ke Halaman Masuk
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const check = await getStaffInviteAction(token);

  if (!check.valid || !check.email || !check.role) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl border border-zinc-200 sm:rounded-2xl sm:px-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-950">Undangan Tidak Valid</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {check.error ||
                "Tautan undangan ini sudah tidak berlaku atau sudah digunakan sebelumnya."}
            </p>
            <div className="pt-2">
              <Link
                href="/login?callbackUrl=/admin/dashboard"
                className="inline-flex w-full justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
              >
                Kembali ke Halaman Masuk
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AcceptInviteClient token={token} email={check.email} role={check.role} />;
}
