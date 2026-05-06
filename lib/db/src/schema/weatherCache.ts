import { pgTable, serial, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weatherCacheTable = pgTable("weather_cache", {
  id: serial("id").primaryKey(),
  temperature: real("temperature").notNull(),
  humidity: real("humidity").notNull(),
  description: text("description").notNull(),
  rainProbability: real("rain_probability").notNull(),
  windSpeed: real("wind_speed").notNull(),
  location: text("location").notNull(),
  forecastJson: text("forecast_json"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeatherCacheSchema = createInsertSchema(weatherCacheTable).omit({ id: true });
export type InsertWeatherCache = z.infer<typeof insertWeatherCacheSchema>;
export type WeatherCache = typeof weatherCacheTable.$inferSelect;
