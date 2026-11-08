import { Clock, KeyRound, ShieldAlert } from "lucide-react";

interface Props {
  userEmail: string;
}

export function TwoFactorEnrollmentCard({ userEmail }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-950">Autentikasi Dua Faktor (2FA Security)</h3>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
          <Clock className="h-3 w-3 text-amber-500" />
          Direncanakan (Roadmap)
        </span>
      </div>

      <p className="text-xs text-zinc-600 leading-relaxed">
        Fitur autentikasi dua faktor (TOTP / Authenticator App dengan kode cadangan dan tantangan
        saat masuk) dijadwalkan untuk tahap hardening keamanan berikutnya (Phase 6) dan saat ini
        belum diaktifkan pada sistem. Akun administratif Anda ({userEmail}) saat ini dilindungi
        dengan verifikasi kata sandi kuat, hashing kriptografi, dan tata kelola peran multi-level.
      </p>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-900">
          <ShieldAlert className="h-4 w-4 text-zinc-500" />
          Spesifikasi Implementasi Masa Depan:
        </div>
        <ul className="list-disc list-inside space-y-1 text-zinc-600 pl-1 text-[11px]">
          <li>Penyediaan secret TOTP dan QR Code melalui plugin resmi Better Auth.</li>
          <li>
            Verifikasi kode 6 digit dari aplikasi authenticator (Google Authenticator, 1Password,
            Aegis).
          </li>
          <li>Penerbitan 10 kode pemulihan darurat sekali pakai (emergency backup codes).</li>
          <li>Tantangan 2FA wajib saat sesi login back-office console dimulai.</li>
        </ul>
        <p className="text-[11px] text-zinc-500 pt-1">
          Rincian perencanaan terdokumentasi pada{" "}
          <code className="font-mono text-zinc-800">docs/ROADMAP.md</code>.
        </p>
      </div>
    </div>
  );
}
