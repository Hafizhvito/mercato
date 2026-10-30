"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth/client";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || "Gagal mendaftarkan akun.");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan saat mendaftar. Silakan coba lagi.");
      setIsLoading(false);
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
            Buat Akun Pelanggan Baru
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Sudah memiliki akun?{" "}
            <Link
              href={
                callbackUrl !== "/"
                  ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                  : "/login"
              }
              className="font-medium text-zinc-950 underline hover:text-zinc-800"
            >
              Masuk
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
              Nama Lengkap
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              placeholder="Nama Anda"
            />
          </div>

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              Password
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-zinc-950 py-2.5 px-4 text-sm font-medium text-white shadow hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:bg-zinc-400"
          >
            {isLoading ? "Memproses..." : "Daftar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-50" />}
    >
      <RegisterForm />
    </Suspense>
  );
}
