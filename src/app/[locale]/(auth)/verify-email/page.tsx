import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-zinc-200 text-center">
        <div>
          <Link href="/" className="text-2xl font-bold tracking-tight text-zinc-950">
            Mercato
          </Link>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">
            Verifikasi Email Anda
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Kami telah mengirimkan tautan verifikasi ke alamat email Anda. Silakan klik tautan
            tersebut untuk mengaktifkan akun Anda sepenuhnya.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex w-full justify-center rounded-md bg-zinc-950 py-2.5 px-4 text-sm font-medium text-white shadow hover:bg-zinc-800 focus:outline-none"
          >
            Lanjut ke Halaman Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
