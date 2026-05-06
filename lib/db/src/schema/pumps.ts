import { pgTable, text, serial, boolean, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";

export const pumpsTable = pgTable("pumps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id),
  status: text("status").notNull().default("off").$type<"on" | "off" | "override">(),
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  driverChannel: text("driver_channel").notNull(),
  runtimeToday: real("runtime_today").notNull().default(0),
  lastToggled: timestamp("last_toggled", { withTimezone: true }),
});

export const insertPumpSchema = createInsertSchema(pumpsTable).omit({ id: true });
export type InsertPump = z.infer<typeof insertPumpSchema>;
export type Pump = typeof pumpsTable.$inferSelect;
