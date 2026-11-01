import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { History, Search } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hasPermission } from "@/server/guards";

interface Props {
  searchParams: Promise<{
    entity?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminAuditLogPage({ searchParams }: Props) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/audit-log");
  }

  if (!hasPermission(session.user.role, "audit_log:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat riwayat audit sistem. Akses terbatas untuk Admin dan
        Owner.
      </div>
    );
  }

  const params = await searchParams;
  const entityFilter = params.entity || "all";
  const actionQuery = params.action?.trim() || "";
  const fromDate = params.from || "";
  const toDate = params.to || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (entityFilter && entityFilter !== "all") {
    conditions.push(eq(schema.auditLogs.entityType, entityFilter));
  }

  if (actionQuery) {
    conditions.push(ilike(schema.auditLogs.action, `%${actionQuery}%`));
  }

  if (fromDate) {
    const d = new Date(fromDate);
    if (!Number.isNaN(d.getTime())) {
      conditions.push(gte(schema.auditLogs.createdAt, d));
    }
  }

  if (toDate) {
    const d = new Date(toDate);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(schema.auditLogs.createdAt, d));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countRows] = await Promise.all([
    db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        entityType: schema.auditLogs.entityType,
        entityId: schema.auditLogs.entityId,
        details: schema.auditLogs.details,
        createdAt: schema.auditLogs.createdAt,
        userId: schema.auditLogs.userId,
        userName: schema.user.name,
        userEmail: schema.user.email,
        userRole: schema.user.role,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.user, eq(schema.auditLogs.userId, schema.user.id))
      .where(whereClause)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(schema.auditLogs).where(whereClause),
  ]);

  const totalCount = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          Riwayat Audit Sistem (Audit Log)
        </h1>
        <p className="text-sm text-zinc-600">
          Catatan aktivitas administratif, perubahan inventaris, pemenuhan pesanan, dan modifikasi
          peran tim.
        </p>
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Action Search */}
          <div>
            <label
              htmlFor="audit-filter-action"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Cari Aksi
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                id="audit-filter-action"
                type="text"
                name="action"
                defaultValue={actionQuery}
                placeholder="Contoh: order.status, stock..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Entity Filter */}
          <div>
            <label
              htmlFor="audit-filter-entity"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Jenis Entitas
            </label>
            <select
              id="audit-filter-entity"
              name="entity"
              defaultValue={entityFilter}
              className="w-full py-1.5 px-2 rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden bg-white"
            >
              <option value="all">Semua Entitas</option>
              <option value="order">Pesanan (Order)</option>
              <option value="product_variant">Inventaris (Variant)</option>
              <option value="discount">Diskon (Discount)</option>
              <option value="user">Pengguna / Staf (User)</option>
              <option value="store">Pengaturan Toko (Store)</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label
              htmlFor="audit-filter-from"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Dari Tanggal
            </label>
            <input
              id="audit-filter-from"
              type="date"
              name="from"
              defaultValue={fromDate}
              className="w-full py-1.5 px-2 rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          {/* Date To */}
          <div>
            <label
              htmlFor="audit-filter-to"
              className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1"
            >
              Sampai Tanggal
            </label>
            <input
              id="audit-filter-to"
              type="date"
              name="to"
              defaultValue={toDate}
              className="w-full py-1.5 px-2 rounded-lg border border-zinc-200 text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 text-xs">
          <Link
            href="/admin/audit-log"
            className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
          >
            Reset Filter
          </Link>
          <button
            type="submit"
            className="px-4 py-1.5 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 transition"
          >
            Terapkan Filter
          </button>
        </div>
      </form>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
            <thead className="bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-3.5">Waktu (WIB)</th>
                <th className="px-6 py-3.5">Aktor</th>
                <th className="px-6 py-3.5">Aksi (Action)</th>
                <th className="px-6 py-3.5">Entitas</th>
                <th className="px-6 py-3.5">Detail Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                    <History className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                    Tidak ada catatan audit log yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let formattedDetails = "";
                  try {
                    formattedDetails =
                      typeof log.details === "string"
                        ? log.details
                        : JSON.stringify(log.details, null, 2);
                  } catch {
                    formattedDetails = String(log.details);
                  }

                  return (
                    <tr key={log.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                        <div className="font-medium text-zinc-800">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", {
                            dateStyle: "medium",
                          })}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                            timeStyle: "medium",
                          })}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-zinc-900">
                          {log.userName || log.userEmail || "Sistem / Otomatis"}
                        </div>
                        {log.userRole && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            {log.userRole}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-zinc-950 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {log.action}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-zinc-800">{log.entityType}</div>
                        {log.entityId && (
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {log.entityId.slice(0, 13)}...
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {formattedDetails && (
                          <pre className="max-w-md max-h-24 overflow-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-700 border border-zinc-200 whitespace-pre-wrap font-mono">
                            {formattedDetails}
                          </pre>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 text-xs text-zinc-600">
            <div>
              Menampilkan {offset + 1} - {Math.min(offset + pageSize, totalCount)} dari {totalCount}{" "}
              log
            </div>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={{
                    pathname: "/admin/audit-log",
                    query: { ...params, page: String(page - 1) },
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-medium text-zinc-800 transition"
                >
                  Sebelumnya
                </Link>
              )}
              <span className="font-medium text-zinc-900">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={{
                    pathname: "/admin/audit-log",
                    query: { ...params, page: String(page + 1) },
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-medium text-zinc-800 transition"
                >
                  Selanjutnya
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
