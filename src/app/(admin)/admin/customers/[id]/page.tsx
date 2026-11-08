import { and, desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  User,
  UserCheck,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { maskEmail, maskPhone } from "@/lib/mask";
import { createMoney, formatMoney } from "@/lib/money";
import { hasPermission } from "@/server/guards";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminCustomerDetailPage({ params }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/customers");
  }

  if (!hasPermission(session.user.role, "customers:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat profil pelanggan ini.
      </div>
    );
  }

  const isStaff = session.user.role === "staff";
  const { id } = await params;

  const [customer] = await db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1);

  if (!customer) {
    notFound();
  }

  const [orders, addresses] = await Promise.all([
    db
      .select()
      .from(schema.orders)
      .where(
        session.user.storeId
          ? and(
              eq(schema.orders.customerId, customer.id),
              eq(schema.orders.storeId, session.user.storeId),
            )
          : eq(schema.orders.customerId, customer.id),
      )
      .orderBy(desc(schema.orders.createdAt)),
    db
      .select()
      .from(schema.customerAddresses)
      .where(eq(schema.customerAddresses.customerId, customer.id))
      .orderBy(desc(schema.customerAddresses.isDefault), desc(schema.customerAddresses.createdAt)),
  ]);

  const paidOrders = orders.filter((o) =>
    ["paid", "processing", "shipped", "delivered"].includes(o.status),
  );
  const totalSpentMinor = paidOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalOrdersCount = orders.length;
  const aovMinor = totalOrdersCount > 0 ? Math.round(totalSpentMinor / totalOrdersCount) : 0;

  const formattedTotalSpent = formatMoney(createMoney(totalSpentMinor, "IDR"));
  const formattedAov = formatMoney(createMoney(aovMinor, "IDR"));
  const displayEmail = isStaff ? maskEmail(customer.email) : customer.email;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/customers"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {customer.name || "Pelanggan Tanpa Nama"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize bg-zinc-100 text-zinc-800 border border-zinc-200">
              {customer.role}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">{displayEmail}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Belanja (Lifetime)</span>
            <CreditCard className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{formattedTotalSpent}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Akumulasi pesanan lunas</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Pesanan</span>
            <ShoppingBag className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{totalOrdersCount}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Termasuk pesanan dalam proses & selesai</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase">Average Order Value (AOV)</span>
            <Package className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">{formattedAov}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Rata-rata nilai per transaksi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order History Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-zinc-950 mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-zinc-500" />
              Riwayat Pesanan Pelanggan ({orders.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
                <thead className="bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">No. Pesanan</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                        Pelanggan belum pernah melakukan checkout pesanan.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-mono font-medium text-zinc-950">
                          #{o.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(o.createdAt).toLocaleDateString("id-ID", {
                            dateStyle: "medium",
                          })}
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-950">
                          {formatMoney(createMoney(o.totalAmount, o.currency))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {o.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-semibold text-zinc-700 hover:text-zinc-950"
                          >
                            Buka &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Info & Saved Addresses */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-500" />
              Detail Akun Pelanggan
            </h3>

            <div className="text-xs text-zinc-600 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-mono text-zinc-800">{displayEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
                <span>
                  Status Email:{" "}
                  <strong>{customer.emailVerified ? "Terverifikasi" : "Belum Verifikasi"}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>
                  Mendaftar:{" "}
                  <strong>
                    {new Date(customer.createdAt).toLocaleDateString("id-ID", {
                      dateStyle: "full",
                    })}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Saved Addresses */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-zinc-500" />
              Buku Alamat Tersimpan ({addresses.length})
            </h3>

            <div className="space-y-3 text-xs">
              {addresses.length === 0 ? (
                <p className="text-zinc-400 italic">Pelanggan belum menyimpan alamat.</p>
              ) : (
                addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`rounded-lg border p-3 space-y-1 ${
                      addr.isDefault
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-zinc-200 bg-zinc-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900">{addr.recipientName}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          Utama (Default)
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-zinc-500 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-zinc-400" />
                      {maskPhone(addr.phone)}
                    </div>
                    <p className="text-zinc-600">{addr.street}</p>
                    <p className="text-zinc-500 text-[11px]">
                      {addr.district}, {addr.city}, {addr.province} {addr.postalCode}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
