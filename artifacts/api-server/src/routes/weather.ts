import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, weatherCacheTable, locationSettingsTable } from "@workspace/db";
import {
  GetCurrentWeatherResponse,
  GetWeatherForecastResponse,
  GetWeatherLocationResponse,
  UpdateWeatherLocationBody,
  UpdateWeatherLocationResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateWeatherData(locationName: string) {
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
    location: locationName,
  };
}

async function getOrCreateLocation() {
  const [loc] = await db.select().from(locationSettingsTable).limit(1);
  if (loc) return loc;
  const [newLoc] = await db.insert(locationSettingsTable).values({
    name: "Farm Location",
    latitude: 20.5937,
    longitude: 78.9629,
  }).returning();
  return newLoc;
}

router.get("/weather/location", async (_req, res): Promise<void> => {
  const loc = await getOrCreateLocation();
  res.json(GetWeatherLocationResponse.parse({
    id: loc.id,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    updatedAt: loc.updatedAt.toISOString(),
  }));
});

router.put("/weather/location", async (req, res): Promise<void> => {
  const body = UpdateWeatherLocationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const existing = await getOrCreateLocation();
  const [updated] = await db
    .update(locationSettingsTable)
    .set({
      name: body.data.name ?? existing.name,
      latitude: body.data.latitude,
      longitude: body.data.longitude,
      updatedAt: new Date(),
    })
    .where(eq(locationSettingsTable.id, existing.id))
    .returning();

  res.json(UpdateWeatherLocationResponse.parse({
    id: updated.id,
    name: updated.name,
    latitude: updated.latitude,
    longitude: updated.longitude,
    updatedAt: updated.updatedAt.toISOString(),
  }));
});

router.get("/weather/current", async (_req, res): Promise<void> => {
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
      latitude: cached.latitude ?? null,
      longitude: cached.longitude ?? null,
      timestamp: cached.recordedAt.toISOString(),
    }));
    return;
  }

  const loc = await getOrCreateLocation();
  const weather = generateWeatherData(loc.name);
  const [newCache] = await db.insert(weatherCacheTable).values({
    ...weather,
    latitude: loc.latitude,
    longitude: loc.longitude,
  }).returning();

  res.json(GetCurrentWeatherResponse.parse({
    ...weather,
    latitude: loc.latitude,
    longitude: loc.longitude,
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
