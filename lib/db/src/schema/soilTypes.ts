import { pgTable, text, serial, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const soilTypesTable = pgTable("soil_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  waterRetentionCapacity: real("water_retention_capacity").notNull(),
  drainageRate: text("drainage_rate").notNull().$type<"slow" | "medium" | "fast">(),
  description: text("description").notNull().default(""),
});

export const insertSoilTypeSchema = createInsertSchema(soilTypesTable).omit({ id: true });
export type InsertSoilType = z.infer<typeof insertSoilTypeSchema>;
export type SoilType = typeof soilTypesTable.$inferSelect;
