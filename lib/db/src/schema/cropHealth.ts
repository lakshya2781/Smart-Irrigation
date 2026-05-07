import { pgTable, serial, real, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";

export const cropHealthTable = pgTable("crop_health", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").references(() => zonesTable.id),
  ndvi: real("ndvi").notNull().default(0.65),
  soilHealthIndex: real("soil_health_index").notNull().default(72),
  waterStressLevel: real("water_stress_level").notNull().default(20),
  growthRate: real("growth_rate").notNull().default(85),
  overallStatus: text("overall_status").notNull().$type<"good" | "moderate" | "critical">().default("good"),
  predictionText: text("prediction_text"),
  riskDrought: real("risk_drought").notNull().default(15),
  riskOverwatering: real("risk_overwatering").notNull().default(10),
  riskDisease: real("risk_disease").notNull().default(8),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCropHealthSchema = createInsertSchema(cropHealthTable).omit({ id: true });
export type InsertCropHealth = z.infer<typeof insertCropHealthSchema>;
export type CropHealth = typeof cropHealthTable.$inferSelect;
