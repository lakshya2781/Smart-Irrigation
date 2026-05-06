import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cropsTable } from "./crops";
import { soilTypesTable } from "./soilTypes";

export const zonesTable = pgTable("zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cropId: integer("crop_id").notNull().references(() => cropsTable.id),
  soilTypeId: integer("soil_type_id").notNull().references(() => soilTypesTable.id),
  targetMoistureMin: real("target_moisture_min").notNull().default(40),
  targetMoistureMax: real("target_moisture_max").notNull().default(70),
  currentMoisture: real("current_moisture").notNull().default(50),
  lastIrrigated: timestamp("last_irrigated", { withTimezone: true }),
  pumpId: integer("pump_id"),
});

export const insertZoneSchema = createInsertSchema(zonesTable).omit({ id: true });
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type Zone = typeof zonesTable.$inferSelect;
