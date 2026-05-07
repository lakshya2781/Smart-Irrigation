import { pgTable, serial, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const locationSettingsTable = pgTable("location_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Farm Location"),
  latitude: real("latitude").notNull().default(20.5937),
  longitude: real("longitude").notNull().default(78.9629),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLocationSettingsSchema = createInsertSchema(locationSettingsTable).omit({ id: true });
export type InsertLocationSettings = z.infer<typeof insertLocationSettingsSchema>;
export type LocationSettings = typeof locationSettingsTable.$inferSelect;
