import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hasPermission } from "@/server/guards";
import { DiscountsClientList } from "./DiscountsClientList";

export default async function AdminDiscountsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/discounts");
  }

  if (!hasPermission(session.user.role, "discounts:view")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Anda tidak memiliki izin untuk melihat manajemen diskon toko.
      </div>
    );
  }

  const canManage = hasPermission(session.user.role, "discounts:manage");

  const discounts = await db
    .select()
    .from(schema.discounts)
    .orderBy(desc(schema.discounts.createdAt));

  return <DiscountsClientList discounts={discounts} canManage={canManage} />;
}
