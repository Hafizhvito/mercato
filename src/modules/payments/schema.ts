import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { orders } from "@/modules/orders/schema";

export const PAYMENT_PROVIDERS = ["midtrans", "stripe"] as const;
export type PaymentProviderType = (typeof PAYMENT_PROVIDERS)[number];

export const paymentSessions = pgTable(
  "payment_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    providerSessionId: varchar("provider_session_id", { length: 255 }).notNull(),
    clientToken: text("client_token"),
    redirectUrl: text("redirect_url"),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_sessions_order_idx").on(table.orderId),
    uniqueIndex("payment_sessions_provider_sess_idx").on(table.provider, table.providerSessionId),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 30 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 255 }).notNull().unique(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("webhook_events_provider_idx").on(table.provider),
    uniqueIndex("webhook_events_provider_id_idx").on(table.provider, table.providerEventId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    providerRefundId: varchar("provider_refund_id", { length: 255 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
    reason: text("reason"),
    restocked: boolean("restocked").notNull().default(false),
    status: varchar("status", { length: 30 }).notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("refunds_order_idx").on(table.orderId)],
);

export type PaymentSession = typeof paymentSessions.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
