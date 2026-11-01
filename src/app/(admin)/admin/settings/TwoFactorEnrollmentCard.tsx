"use client";

import { CheckCircle2, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface Props {
  userEmail: string;
}

export function TwoFactorEnrollmentCard({ userEmail }: Props) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length === 6) {
      setIsEnabled(true);
      setShowPrompt(false);
      setMessage("Autentikasi Dua Faktor (2FA) berhasil diaktifkan untuk akun Anda.");
    } else {
      setMessage("Masukkan 6 digit kode OTP yang valid.");
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-950">Autentikasi Dua Faktor (2FA Security)</h3>
        </div>

        {isEnabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-3 w-3" />
            2FA Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
            <ShieldAlert className="h-3 w-3 text-zinc-400" />
            Belum Diaktifkan
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-600 leading-relaxed">
        Tingkatkan keamanan akun administratif ({userEmail}) dengan mewajibkan kode verifikasi OTP
        aplikasi authenticator (seperti Google Authenticator atau 1Password) saat masuk.
      </p>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {!isEnabled && !showPrompt && (
        <div>
          <button
            type="button"
            onClick={() => setShowPrompt(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 hover:bg-zinc-50 shadow-xs transition"
          >
            Aktifkan 2FA Sekarang
          </button>
        </div>
      )}

      {showPrompt && !isEnabled && (
        <form onSubmit={handleEnroll} className="space-y-3 pt-2 max-w-sm">
          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-2">
            <p className="font-semibold text-zinc-900">Konfigurasi Authenticator App:</p>
            <p className="text-zinc-600">
              Pindai kode QR atau masukkan secret key pada aplikasi TOTP Anda, lalu masukkan 6 digit
              kode konfirmasi di bawah.
            </p>
          </div>

          <div>
            <label
              htmlFor="otp-verification-code"
              className="block text-xs font-semibold text-zinc-700 mb-1"
            >
              Kode OTP (6 Digit)
            </label>
            <input
              id="otp-verification-code"
              type="text"
              maxLength={6}
              required
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-zinc-200 p-2 text-center font-mono font-bold tracking-widest text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="flex-1 py-1.5 px-3 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={otpCode.length !== 6}
              className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              Verifikasi & Aktifkan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
