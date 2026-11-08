"use client";

import { FileText, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addOrderNoteAction } from "@/modules/orders/actions";

interface OrderNote {
  id: string;
  authorName: string;
  note: string;
  createdAt: Date;
}

interface Props {
  orderId: string;
  initialNotes: OrderNote[];
}

export function AdminNotesForm({ orderId, initialNotes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    setError(null);
    startTransition(async () => {
      try {
        await addOrderNoteAction({ orderId, note: note.trim() });
        setNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add note");
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-950">Catatan Internal Staf</h3>
        </div>
        <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
          Hanya Staf & Admin (Internal)
        </span>
      </div>

      <p className="text-xs text-zinc-500">
        Catatan internal tidak akan pernah ditampilkan kepada pelanggan pada halaman akun
        storefront.
      </p>

      {/* Existing Notes List */}
      <div className="space-y-2.5 max-h-60 overflow-y-auto">
        {initialNotes.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">
            Belum ada catatan internal untuk pesanan ini.
          </p>
        ) : (
          initialNotes.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900">{n.authorName}</span>
                <span className="text-[10px] text-zinc-400">
                  {new Date(n.createdAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="text-zinc-700 whitespace-pre-wrap">{n.note}</p>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Add Note Form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-zinc-100">
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tulis catatan penanganan pesanan, kendala pengiriman, atau follow up..."
          className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
          disabled={isPending}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !note.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 py-1.5 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Simpan Catatan
          </button>
        </div>
      </form>
    </div>
  );
}
