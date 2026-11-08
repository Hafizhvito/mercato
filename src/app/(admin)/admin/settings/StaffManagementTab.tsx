"use client";

import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Loader2,
  Mail,
  Plus,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { User } from "@/lib/db/schema";
import { inviteStaffAction, updateStaffRoleAction } from "@/modules/settings/actions";
import type { UserRole } from "@/server/guards";

interface Props {
  currentUserId: string;
  currentUserRole: UserRole;
  staffList: User[];
  canManageStaff: boolean;
}

export function StaffManagementTab({
  currentUserId,
  currentUserRole,
  staffList,
  canManageStaff,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite staff form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");

  const isOwner = currentUserRole === "owner";
  const ownerCount = staffList.filter((s) => s.role === "owner").length;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await inviteStaffAction({ email, role });
        setSuccess(
          `Undangan aktivasi berhasil dikirim ke "${email}" sebagai peran ${role}. Tautan undangan telah dicetak ke server log.`,
        );
        setModalOpen(false);
        setEmail("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengundang staf");
      }
    });
  };

  const handleRoleChange = (targetUser: User, nextRole: UserRole) => {
    if (targetUser.role === nextRole) return;
    setError(null);
    setSuccess(null);

    // Frontend validations before dispatching
    if (targetUser.id === currentUserId) {
      alert("Keamanan: Anda tidak dapat mengubah peran administratif akun Anda sendiri.");
      return;
    }

    if (targetUser.role === "owner" && nextRole !== "owner" && ownerCount <= 1) {
      alert("Keamanan: Owner terakhir toko tidak dapat diturunkan perannya.");
      return;
    }

    if (
      !confirm(
        `Ubah peran ${targetUser.name || targetUser.email} dari ${targetUser.role} menjadi ${nextRole}?`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await updateStaffRoleAction({
          targetUserId: targetUser.id,
          newRole: nextRole,
        });
        setSuccess(`Peran ${targetUser.email} berhasil diubah menjadi ${nextRole}.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengubah peran staf");
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            Manajemen Tim & Akun Staf (Team Governance)
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Kelola peran operasional staf, hak akses administratif, dan delegasi tugas.
          </p>
        </div>

        {canManageStaff && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 py-2 px-3 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Anggota Staf
          </button>
        )}
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="overflow-x-auto border border-zinc-200 rounded-lg">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
          <thead className="bg-zinc-50 font-semibold text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Nama Anggota</th>
              <th className="px-4 py-3">Email Akun</th>
              <th className="px-4 py-3">Peran (Role)</th>
              <th className="px-4 py-3">Status Email</th>
              <th className="px-4 py-3 text-right">Ubah Peran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {staffList.map((st) => {
              const isSelf = st.id === currentUserId;
              const isTargetOwner = st.role === "owner";
              const canEditThisUser =
                canManageStaff && !isSelf && (isOwner || (!isOwner && !isTargetOwner));

              return (
                <tr key={st.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-semibold text-zinc-900">
                    <div className="flex items-center gap-2">
                      {st.name || "Staf Tanpa Nama"}
                      {isSelf && (
                        <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                          Anda
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-mono text-zinc-600">{st.email}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] ${
                        st.role === "owner"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : st.role === "admin"
                            ? "bg-purple-100 text-purple-900 border border-purple-200"
                            : "bg-blue-50 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {st.role === "owner" ? (
                        <Crown className="h-3 w-3 text-amber-700" />
                      ) : (
                        <Shield className="h-3 w-3 text-zinc-500" />
                      )}
                      {st.role}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {st.emailVerified ? (
                      <span className="text-emerald-700 font-medium">Terverifikasi</span>
                    ) : (
                      <span className="text-zinc-400">Belum</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {canEditThisUser ? (
                      <select
                        disabled={isPending}
                        value={st.role}
                        onChange={(e) => handleRoleChange(st, e.target.value as UserRole)}
                        className="py-1 px-2 rounded-md border border-zinc-200 bg-white text-zinc-900 font-semibold focus:border-zinc-900 focus:outline-hidden text-xs"
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        {isOwner && <option value="owner">Owner</option>}
                      </select>
                    ) : (
                      <span className="text-[11px] text-zinc-400 italic">
                        {isSelf ? "Akun Sendiri" : "Terkunci"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h4 className="text-base font-bold text-zinc-950">Undang Anggota Tim Baru</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Tautan aktivasi berbatas waktu (48 jam) akan dikirimkan ke email ini. Calon staf
                  akan mengatur kata sandi mereka sendiri secara aman.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-3 text-xs">
              <div>
                <label htmlFor="staff-email" className="block font-semibold text-zinc-700 mb-1">
                  Alamat Email Calon Anggota
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="staf@mercato.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label htmlFor="staff-role" className="block font-semibold text-zinc-700 mb-1">
                  Peran Administratif
                </label>
                <select
                  id="staff-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "staff" | "admin")}
                  className="w-full rounded-lg border border-zinc-200 p-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
                >
                  <option value="staff">
                    Staff (Fulfillment, Stok, Pesanan, Profil Pelanggan)
                  </option>
                  <option value="admin">
                    Admin (Operasional Penuh, Diskon, Pengaturan, Analitik, Audit Log)
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  Kirim Undangan Aktivasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
