import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { stores } from "@/lib/db/schema";
import { productVariants } from "@/modules/catalog/schema";

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'committed' | 'expired' | 'released'
    checkoutSessionId: varchar("checkout_session_id", { length: 64 }).notNull(),
    orderId: uuid("order_id"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("stock_reservations_variant_status_idx").on(table.variantId, table.status),
    index("stock_reservations_session_idx").on(table.checkoutSessionId),
    index("stock_reservations_expiry_idx").on(table.status, table.reservedUntil),
  ],
);

export type StockReservation = typeof stockReservations.$inferSelect;
export type NewStockReservation = typeof stockReservations.$inferInsert;
