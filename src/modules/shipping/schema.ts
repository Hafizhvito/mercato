import { index, pgTable, varchar } from "drizzle-orm/pg-core";

export const indonesianProvinces = pgTable("indonesian_provinces", {
  code: varchar("code", { length: 2 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const indonesianRegencies = pgTable(
  "indonesian_regencies",
  {
    code: varchar("code", { length: 5 }).primaryKey(),
    provinceCode: varchar("province_code", { length: 2 })
      .notNull()
      .references(() => indonesianProvinces.code, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
  },
  (table) => [index("regencies_province_idx").on(table.provinceCode)],
);

export const indonesianDistricts = pgTable(
  "indonesian_districts",
  {
    code: varchar("code", { length: 8 }).primaryKey(),
    regencyCode: varchar("regency_code", { length: 5 })
      .notNull()
      .references(() => indonesianRegencies.code, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
  },
  (table) => [index("districts_regency_idx").on(table.regencyCode)],
);

export const indonesianVillages = pgTable(
  "indonesian_villages",
  {
    code: varchar("code", { length: 13 }).primaryKey(),
    districtCode: varchar("district_code", { length: 8 })
      .notNull()
      .references(() => indonesianDistricts.code, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
  },
  (table) => [index("villages_district_idx").on(table.districtCode)],
);

export type IndonesianProvince = typeof indonesianProvinces.$inferSelect;
export type IndonesianRegency = typeof indonesianRegencies.$inferSelect;
export type IndonesianDistrict = typeof indonesianDistricts.$inferSelect;
export type IndonesianVillage = typeof indonesianVillages.$inferSelect;
