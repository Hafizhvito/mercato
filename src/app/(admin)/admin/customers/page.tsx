import { desc, ilike, or, sql } from "drizzle-orm";
import { Eye, Search, ShoppingBag, UserCheck, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskEmail } from "@/lib/mask";
import { createMoney, formatMoney } from "@/lib/money";
import { hasPermission } from "@/server/guards";

interface Props {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/customers");
  }

  if (!hasPermission(session.user.role, "customers:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat daftar pelanggan toko.
      </div>
    );
  }

  const isStaff = session.user.role === "staff";
  const params = await searchParams;
  const q = params.q?.trim() || "";

  // Query customers with their lifetime order metrics
  const customers = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      emailVerified: schema.user.emailVerified,
      createdAt: schema.user.createdAt,
      totalOrders: sql<number>`
        (SELECT COUNT(o.id)
         FROM ${schema.orders} o
         WHERE o.customer_id = ${schema.user.id}
        )::int
      `,
      totalSpent: sql<number>`
        COALESCE(
          (SELECT SUM(o.total_amount)
           FROM ${schema.orders} o
           WHERE o.customer_id = ${schema.user.id}
             AND o.status IN ('paid', 'processing', 'shipped', 'delivered')),
          0
        )::int
      `,
    })
    .from(schema.user)
    .where(
      q ? or(ilike(schema.user.name, `%${q}%`), ilike(schema.user.email, `%${q}%`)) : undefined,
    )
    .orderBy(desc(schema.user.createdAt));

  const totalRegistered = customers.length;
  const totalWithOrders = customers.filter((c) => c.totalOrders > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Pelanggan (Customers)</h1>
          <p className="text-sm text-zinc-600">
            Daftar akun pelanggan terdaftar, riwayat transaksi, dan profil pembeli.
          </p>
        </div>

        {isStaff && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
            Akses Staf: Mode Hanya Baca (Read-Only)
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Pelanggan Terdaftar</span>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{totalRegistered}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Akun toko terverifikasi dan aktif</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Pelanggan Dengan Transaksi</span>
            <ShoppingBag className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{totalWithOrders}</div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {totalRegistered > 0
              ? `${Math.round((totalWithOrders / totalRegistered) * 100)}% dari total pelanggan`
              : "0%"}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form method="GET" className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Cari berdasarkan nama atau email pelanggan..."
          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
        />
      </form>

      {/* Customer List Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-3.5">Pelanggan</th>
                <th className="px-6 py-3.5">Status Akun</th>
                <th className="px-6 py-3.5 text-center">Total Pesanan</th>
                <th className="px-6 py-3.5 text-right">Total Belanja (Spent)</th>
                <th className="px-6 py-3.5">Terdaftar Sejak</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
                    <Users className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                    Tidak ada pelanggan yang ditemukan.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const formattedSpent = formatMoney(createMoney(cust.totalSpent, "IDR"));
                  const displayEmail = isStaff ? maskEmail(cust.email) : cust.email;

                  return (
                    <tr key={cust.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-zinc-950 text-xs">
                          {cust.name || "Tanpa Nama"}
                        </div>
                        <div className="text-zinc-500 text-[11px] font-mono">{displayEmail}</div>
                      </td>

                      <td className="px-6 py-4">
                        {cust.emailVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <UserCheck className="h-3 w-3" />
                            Terverifikasi
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-zinc-100 text-zinc-600">
                            Belum Verifikasi
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center font-bold text-xs text-zinc-950">
                        {cust.totalOrders}
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-xs text-zinc-950">
                        {formattedSpent}
                      </td>

                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {new Date(cust.createdAt).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/customers/${cust.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition"
                        >
                          <Eye className="h-4 w-4" />
                          Profil
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
