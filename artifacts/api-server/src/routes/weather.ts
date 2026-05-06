import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, weatherCacheTable } from "@workspace/db";
import {
  GetCurrentWeatherResponse,
  GetWeatherForecastResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Simulated weather data (in a real deployment this would call OpenWeatherMap API)
function generateWeatherData() {
  const baseTemp = 28 + (Math.random() - 0.5) * 6;
  const baseHumidity = 60 + (Math.random() - 0.5) * 20;
  const rainProb = Math.random() * 100;
  const descriptions = ["Clear sky", "Partly cloudy", "Overcast", "Light rain expected", "Sunny"];
  const description = descriptions[Math.floor(Math.random() * descriptions.length)];

  return {
    temperature: Math.round(baseTemp * 10) / 10,
    humidity: Math.round(baseHumidity),
    description,
    rainProbability: Math.round(rainProb),
    windSpeed: Math.round((5 + Math.random() * 20) * 10) / 10,
    location: "Farm Location",
  };
}

router.get("/weather/current", async (_req, res): Promise<void> => {
  // Try to get cached weather first (within last 30 min)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const [cached] = await db
    .select()
    .from(weatherCacheTable)
    .orderBy(desc(weatherCacheTable.recordedAt))
    .limit(1);

  if (cached && cached.recordedAt > thirtyMinAgo) {
    res.json(GetCurrentWeatherResponse.parse({
      temperature: cached.temperature,
      humidity: cached.humidity,
      description: cached.description,
      rainProbability: cached.rainProbability,
      windSpeed: cached.windSpeed,
      location: cached.location,
      timestamp: cached.recordedAt.toISOString(),
    }));
    return;
  }

  // Generate new weather data and cache it
  const weather = generateWeatherData();
  const [newCache] = await db.insert(weatherCacheTable).values({
    ...weather,
  }).returning();

  res.json(GetCurrentWeatherResponse.parse({
    ...weather,
    timestamp: newCache.recordedAt.toISOString(),
  }));
});

router.get("/weather/forecast", async (_req, res): Promise<void> => {
  const days: { date: string; highTemp: number; lowTemp: number; rainProbability: number; description: string; irrigationRecommended: boolean }[] = [];

  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const rainProb = Math.round(Math.random() * 100);
    const highTemp = Math.round((25 + Math.random() * 12) * 10) / 10;
    const descriptions = ["Clear sky", "Partly cloudy", "Overcast", "Light rain", "Thunderstorm risk"];

    days.push({
      date: date.toISOString().split("T")[0],
      highTemp,
      lowTemp: Math.round((highTemp - 8 - Math.random() * 4) * 10) / 10,
      rainProbability: rainProb,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      irrigationRecommended: rainProb < 50,
    });
  }

  res.json(GetWeatherForecastResponse.parse(days));
});

export default router;
