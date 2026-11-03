"use client";

import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { acceptStaffInviteAction } from "@/modules/settings/actions";

interface Props {
  token: string;
  email: string;
  role: string;
}

export function AcceptInviteClient({ token, email, role }: Props) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }

    startTransition(async () => {
      try {
        await acceptStaffInviteAction({ token, name, password });
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengaktifkan akun.");
      }
    });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl border border-zinc-200 sm:rounded-2xl sm:px-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-950">Akun Berhasil Diaktifkan!</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Selamat datang di tim Mercato sebagai <strong>{role}</strong>. Akun ({email}) Anda
              telah aktif dan siap digunakan.
            </p>
            <div className="pt-2">
              <Link
                href="/login?callbackUrl=/admin/dashboard"
                className="inline-flex w-full justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition"
              >
                Masuk ke Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white mb-2 shadow-xs">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          Aktivasi Akun Tim Mercato
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Anda diundang bergabung sebagai <strong>{role}</strong> untuk akun{" "}
          <span className="font-mono text-zinc-800">{email}</span>.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-zinc-200 sm:rounded-2xl sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="staff-name" className="block font-semibold text-zinc-700 mb-1">
                Nama Lengkap Anda
              </label>
              <input
                id="staff-name"
                type="text"
                required
                placeholder="Nama Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="staff-password" className="block font-semibold text-zinc-700 mb-1">
                Kata Sandi Baru (Minimal 8 Karakter)
              </label>
              <input
                id="staff-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label
                htmlFor="staff-confirm-password"
                className="block font-semibold text-zinc-700 mb-1"
              >
                Ulangi Kata Sandi Baru
              </label>
              <input
                id="staff-confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Aktifkan Akun & Simpan Kata Sandi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
