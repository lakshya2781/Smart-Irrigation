import { pgTable, text, serial, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cropsTable = pgTable("crops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  idealMoistureMin: real("ideal_moisture_min").notNull(),
  idealMoistureMax: real("ideal_moisture_max").notNull(),
  waterRequirementMm: real("water_requirement_mm").notNull(),
  growthStages: jsonb("growth_stages").notNull().$type<string[]>(),
  description: text("description").notNull().default(""),
});

export const insertCropSchema = createInsertSchema(cropsTable).omit({ id: true });
export type InsertCrop = z.infer<typeof insertCropSchema>;
export type Crop = typeof cropsTable.$inferSelect;
