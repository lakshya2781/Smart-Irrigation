import { pgTable, serial, real, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sensorReadingsTable = pgTable("sensor_readings", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id"),
  moisture: real("moisture"),
  temperature: real("temperature"),
  humidity: real("humidity"),
  tankLevelPercent: real("tank_level_percent"),
  waterLoggingDetected: boolean("water_logging_detected"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSensorReadingSchema = createInsertSchema(sensorReadingsTable).omit({ id: true });
export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type SensorReading = typeof sensorReadingsTable.$inferSelect;
