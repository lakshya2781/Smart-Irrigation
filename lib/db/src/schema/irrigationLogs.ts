import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";
import { pumpsTable } from "./pumps";

export const irrigationLogsTable = pgTable("irrigation_logs", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id),
  pumpId: integer("pump_id").notNull().references(() => pumpsTable.id),
  action: text("action").notNull().$type<"started" | "stopped">(),
  trigger: text("trigger").notNull().$type<"auto" | "manual" | "override" | "ai">(),
  durationSeconds: integer("duration_seconds"),
  soilMoistureBefore: real("soil_moisture_before"),
  soilMoistureAfter: real("soil_moisture_after"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIrrigationLogSchema = createInsertSchema(irrigationLogsTable).omit({ id: true, createdAt: true });
export type InsertIrrigationLog = z.infer<typeof insertIrrigationLogSchema>;
export type IrrigationLog = typeof irrigationLogsTable.$inferSelect;
