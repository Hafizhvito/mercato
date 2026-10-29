import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session) {
    redirect("/login?callbackUrl=/admin/dashboard");
  }

  const role = session.user.role;
  if (role !== "admin" && role !== "owner" && role !== "staff") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-zinc-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col justify-between">
        <div>
          <div className="flex h-16 items-center px-6 border-b border-zinc-200">
            <span className="text-xl font-bold tracking-tight text-zinc-950">Mercato Admin</span>
          </div>
          <nav className="p-4 space-y-1 text-sm font-medium">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-900 bg-zinc-100 hover:bg-zinc-200"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/products"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Produk
            </Link>
            <Link
              href="/admin/inventory"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Inventaris
            </Link>
            <Link
              href="/admin/orders"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Pesanan
            </Link>
            <Link
              href="/admin/customers"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Pelanggan
            </Link>
            <Link
              href="/admin/discounts"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Diskon
            </Link>
            <Link
              href="/admin/analytics"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Analitik
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Pengaturan
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-900">{session.user.name}</p>
              <p className="text-xs text-zinc-500 capitalize">{session.user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
