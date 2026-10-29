"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-zinc-200">
        <div>
          <Link href="/" className="text-2xl font-bold tracking-tight text-zinc-950">
            Mercato
          </Link>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">Lupa Password</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Masukkan alamat email Anda untuk menerima instruksi pemulihan kata sandi.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
            Jika alamat email terdaftar di sistem kami, tautan pemulihan kata sandi telah dikirim.
            Silakan periksa kotak masuk atau spam Anda.
            <div className="mt-4">
              <Link href="/login" className="font-semibold text-green-950 underline">
                Kembali ke halaman masuk
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                placeholder="nama@domain.com"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-950 py-2.5 px-4 text-sm font-medium text-white shadow hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
            >
              Kirim Tautan Pemulihan
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
