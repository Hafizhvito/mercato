import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { stores, user } from "@/lib/db/schema";
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

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 255 }).notNull(),
    previousStock: integer("previous_stock").notNull(),
    newStock: integer("new_stock").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("stock_adjustments_variant_idx").on(table.variantId),
    index("stock_adjustments_store_idx").on(table.storeId),
  ],
);

export type StockReservation = typeof stockReservations.$inferSelect;
export type NewStockReservation = typeof stockReservations.$inferInsert;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type NewStockAdjustment = typeof stockAdjustments.$inferInsert;
