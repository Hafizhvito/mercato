export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Merchant Dashboard</h1>
        <p className="text-sm text-zinc-600">
          Ringkasan performa penjualan dan operasional toko Mercato.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total Pendapatan
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">Rp 0</p>
          <p className="mt-1 text-xs text-zinc-500">Masa perkenalan platform</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Pesanan Masuk
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">0</p>
          <p className="mt-1 text-xs text-zinc-500">Semua pesanan terproses</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Produk Aktif</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">0</p>
          <p className="mt-1 text-xs text-zinc-500">Katalog siap publikasi</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Stok Kritis</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">0</p>
          <p className="mt-1 text-xs text-zinc-500">Perlu reorder segera</p>
        </div>
      </div>
    </div>
  );
}
