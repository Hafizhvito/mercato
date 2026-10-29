import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
  locale: varchar("locale", { length: 5 }).notNull().default("id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
