"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [completed, setCompleted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === confirmPassword) {
      setCompleted(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-zinc-200">
        <div>
          <Link href="/" className="text-2xl font-bold tracking-tight text-zinc-950">
            Mercato
          </Link>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">
            Atur Ulang Password
          </h2>
          <p className="mt-2 text-sm text-zinc-600">Masukkan kata sandi baru untuk akun Anda.</p>
        </div>

        {completed ? (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
            Kata sandi Anda berhasil diperbarui.
            <div className="mt-4">
              <Link href="/login" className="font-semibold text-green-950 underline">
                Masuk dengan kata sandi baru
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Password Baru
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700">
                Konfirmasi Password Baru
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-950 py-2.5 px-4 text-sm font-medium text-white shadow hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
            >
              Simpan Password Baru
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
