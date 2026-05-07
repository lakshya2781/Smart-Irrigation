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

const OWM_BASE = "https://api.openweathermap.org/data/2.5";

function getApiKey(): string | undefined {
  return process.env["OPENWEATHER_API_KEY"];
}

function owmDescriptionToInternal(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("thunderstorm")) return "Thunderstorm risk";
  if (d.includes("drizzle"))      return "Light drizzle";
  if (d.includes("rain"))         return "Rain expected";
  if (d.includes("snow"))         return "Snow";
  if (d.includes("mist") || d.includes("fog") || d.includes("haze")) return "Misty / low visibility";
  if (d.includes("clear"))        return "Clear sky";
  if (d.includes("few clouds"))   return "Partly cloudy";
  if (d.includes("scattered"))    return "Scattered clouds";
  if (d.includes("overcast") || d.includes("broken")) return "Overcast";
  return description.charAt(0).toUpperCase() + description.slice(1);
}

function rainProbFromCurrent(data: {
  rain?: { "1h"?: number };
  clouds?: { all?: number };
  weather?: { main?: string }[];
}): number {
  if (data.rain?.["1h"] != null && data.rain["1h"] > 0) return 85;
  const weatherMain = data.weather?.[0]?.main?.toLowerCase() ?? "";
  if (weatherMain === "thunderstorm") return 90;
  if (weatherMain === "rain") return 80;
  if (weatherMain === "drizzle") return 65;
  if (weatherMain === "snow") return 70;
  const clouds = data.clouds?.all ?? 0;
  return Math.round(clouds * 0.55);
}

async function fetchCurrentWeatherFromOWM(lat: number, lon: number): Promise<{
  temperature: number;
  humidity: number;
  description: string;
  rainProbability: number;
  windSpeed: number;
  location: string;
} | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const url = `${OWM_BASE}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      main: { temp: number; humidity: number };
      wind: { speed: number };
      weather: { description: string; main: string }[];
      name: string;
      clouds?: { all?: number };
      rain?: { "1h"?: number };
    };

    return {
      temperature: Math.round(data.main.temp * 10) / 10,
      humidity: Math.round(data.main.humidity),
      description: owmDescriptionToInternal(data.weather[0]?.description ?? ""),
      rainProbability: rainProbFromCurrent({ rain: data.rain, clouds: data.clouds, weather: data.weather }),
      windSpeed: Math.round(data.wind.speed * 3.6 * 10) / 10, // m/s → km/h
      location: data.name || "Farm Location",
    };
  } catch {
    return null;
  }
}

async function fetchForecastFromOWM(lat: number, lon: number): Promise<{
  date: string;
  highTemp: number;
  lowTemp: number;
  rainProbability: number;
  description: string;
  irrigationRecommended: boolean;
}[] | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const url = `${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      list: {
        dt: number;
        main: { temp_min: number; temp_max: number; humidity: number };
        weather: { description: string }[];
        pop: number; // probability of precipitation 0–1
      }[];
    };

    // Group 3h intervals into days
    const grouped: Record<string, {
      temps: number[];
      pops: number[];
      descriptions: string[];
    }> = {};

    for (const item of data.list) {
      const date = new Date(item.dt * 1000).toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = { temps: [], pops: [], descriptions: [] };
      grouped[date].temps.push(item.main.temp_min, item.main.temp_max);
      grouped[date].pops.push(item.pop);
      grouped[date].descriptions.push(item.weather[0]?.description ?? "");
    }

    const days = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5)
      .map(([date, g]) => {
        const highTemp = Math.round(Math.max(...g.temps) * 10) / 10;
        const lowTemp  = Math.round(Math.min(...g.temps) * 10) / 10;
        const rainProb = Math.round(Math.max(...g.pops) * 100);
        const desc = owmDescriptionToInternal(g.descriptions[Math.floor(g.descriptions.length / 2)] ?? "");
        return { date, highTemp, lowTemp, rainProbability: rainProb, description: desc, irrigationRecommended: rainProb < 50 };
      });

    return days.length > 0 ? days : null;
  } catch {
    return null;
  }
}

function simulatedWeather(locationName: string) {
  const baseTemp = 28 + (Math.random() - 0.5) * 6;
  const descriptions = ["Clear sky", "Partly cloudy", "Overcast", "Light rain expected", "Sunny"];
  return {
    temperature: Math.round(baseTemp * 10) / 10,
    humidity: Math.round(60 + (Math.random() - 0.5) * 20),
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    rainProbability: Math.round(Math.random() * 100),
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

// ─── GET /weather/location ───────────────────────────────────────────────────

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

// ─── PUT /weather/location ───────────────────────────────────────────────────

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

  // Invalidate weather cache after location change
  await db.delete(weatherCacheTable);

  res.json(UpdateWeatherLocationResponse.parse({
    id: updated.id,
    name: updated.name,
    latitude: updated.latitude,
    longitude: updated.longitude,
    updatedAt: updated.updatedAt.toISOString(),
  }));
});

// ─── GET /weather/current ────────────────────────────────────────────────────

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
  const real = await fetchCurrentWeatherFromOWM(loc.latitude, loc.longitude);
  const weather = real ?? simulatedWeather(loc.name);

  // Use the OWM-returned name to keep location in sync
  const locationName = real?.location ?? loc.name;

  const [newCache] = await db.insert(weatherCacheTable).values({
    temperature: weather.temperature,
    humidity: weather.humidity,
    description: weather.description,
    rainProbability: weather.rainProbability,
    windSpeed: weather.windSpeed,
    location: locationName,
    latitude: loc.latitude,
    longitude: loc.longitude,
  }).returning();

  res.json(GetCurrentWeatherResponse.parse({
    temperature: weather.temperature,
    humidity: weather.humidity,
    description: weather.description,
    rainProbability: weather.rainProbability,
    windSpeed: weather.windSpeed,
    location: locationName,
    latitude: loc.latitude,
    longitude: loc.longitude,
    timestamp: newCache.recordedAt.toISOString(),
  }));
});

// ─── GET /weather/forecast ───────────────────────────────────────────────────

router.get("/weather/forecast", async (_req, res): Promise<void> => {
  const loc = await getOrCreateLocation();
  const real = await fetchForecastFromOWM(loc.latitude, loc.longitude);

  if (real) {
    res.json(GetWeatherForecastResponse.parse(real));
    return;
  }

  // Fallback: simulated 5-day forecast
  const days: { date: string; highTemp: number; lowTemp: number; rainProbability: number; description: string; irrigationRecommended: boolean }[] = [];
  const descriptions = ["Clear sky", "Partly cloudy", "Overcast", "Light rain", "Thunderstorm risk"];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const rainProb = Math.round(Math.random() * 100);
    const high = Math.round((25 + Math.random() * 12) * 10) / 10;
    days.push({
      date: date.toISOString().split("T")[0],
      highTemp: high,
      lowTemp: Math.round((high - 8 - Math.random() * 4) * 10) / 10,
      rainProbability: rainProb,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      irrigationRecommended: rainProb < 50,
    });
  }

  res.json(GetWeatherForecastResponse.parse(days));
});

export default router;
