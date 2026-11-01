"use client";

import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCustomerProfileAction } from "@/modules/customers/actions";

interface Props {
  initialName: string;
  email: string;
  labels: {
    name: string;
    email: string;
    saveProfile: string;
    profileUpdated: string;
  };
}

export function ProfileForm({ initialName, email, labels }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await updateCustomerProfileAction({ name: name.trim() });
        setSuccess(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memperbarui profil");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{labels.profileUpdated}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="customer-name" className="block text-xs font-semibold text-zinc-700 mb-1">
          {labels.name}
        </label>
        <input
          id="customer-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 p-2 text-xs font-medium text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
        />
      </div>

      <div>
        <label htmlFor="customer-email" className="block text-xs font-semibold text-zinc-700 mb-1">
          {labels.email}
        </label>
        <input
          id="customer-email"
          type="email"
          disabled
          value={email}
          className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-500 bg-zinc-100 cursor-not-allowed font-mono"
        />
        <p className="text-[11px] text-zinc-400 mt-1">
          Alamat email terikat pada akun Anda dan digunakan untuk notifikasi pesanan.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 py-2 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {labels.saveProfile}
        </button>
      </div>
    </form>
  );
}
