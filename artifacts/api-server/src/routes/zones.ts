import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, zonesTable, cropsTable, soilTypesTable, pumpsTable, sensorReadingsTable, weatherCacheTable } from "@workspace/db";
import {
  GetZoneParams,
  GetZoneResponse,
  GetZonesResponse,
  UpdateZoneParams,
  UpdateZoneBody,
  UpdateZoneResponse,
  GetZoneMoistureTrendParams,
  GetZoneMoistureTrendQueryParams,
  GetZoneMoistureTrendResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function pumpStatusForZone(pumpStatus: string | null, isOverride: boolean): "on" | "off" | "override" {
  if (isOverride) return "override";
  if (pumpStatus === "on") return "on";
  return "off";
}

function zoneStatus(moisture: number, min: number, max: number, waterLogging: boolean): "optimal" | "dry" | "wet" | "waterlogged" | "unknown" {
  if (waterLogging) return "waterlogged";
  if (moisture < min - 10) return "dry";
  if (moisture > max + 10) return "wet";
  if (moisture >= min && moisture <= max) return "optimal";
  return "unknown";
}

function computeRecommendation(
  moisture: number, targetMin: number, targetMax: number, retention: number, rainProb: number
): { recommendation: "irrigate" | "skip" | "monitor"; reasoning: string; suggestedDurationMinutes: number } {
  if (rainProb >= 90) {
    return { recommendation: "skip", reasoning: "High rain probability — skip irrigation to avoid overwatering.", suggestedDurationMinutes: 0 };
  }
  if (moisture < targetMin - 5) {
    if (rainProb >= 50) {
      return { recommendation: "monitor", reasoning: `Moisture at ${moisture.toFixed(1)}% is below threshold but moderate rain expected. Monitor for 2 hours.`, suggestedDurationMinutes: 0 };
    }
    const deficit = targetMax - moisture;
    const mins = Math.round((deficit / 10) * (1 - retention) * 30 + 10);
    return { recommendation: "irrigate", reasoning: `Soil moisture at ${moisture.toFixed(1)}% is below minimum (${targetMin}%). Estimated ${mins} min irrigation needed.`, suggestedDurationMinutes: mins };
  }
  if (moisture > targetMax + 5) {
    return { recommendation: "skip", reasoning: `Soil moisture at ${moisture.toFixed(1)}% exceeds maximum (${targetMax}%). Risk of waterlogging — skip.`, suggestedDurationMinutes: 0 };
  }
  return { recommendation: "monitor", reasoning: `Moisture at ${moisture.toFixed(1)}% is within optimal range (${targetMin}%–${targetMax}%). No irrigation needed.`, suggestedDurationMinutes: 0 };
}

async function getLatestRainProb(): Promise<number> {
  const [weather] = await db.select({ rainProbability: weatherCacheTable.rainProbability }).from(weatherCacheTable).orderBy(desc(weatherCacheTable.recordedAt)).limit(1);
  return weather?.rainProbability ?? 40;
}

router.get("/zones", async (_req, res): Promise<void> => {
  const rainProb = await getLatestRainProb();

  const zones = await db
    .select({
      id: zonesTable.id,
      name: zonesTable.name,
      cropId: zonesTable.cropId,
      cropName: cropsTable.name,
      soilTypeId: zonesTable.soilTypeId,
      soilTypeName: soilTypesTable.name,
      currentMoisture: zonesTable.currentMoisture,
      targetMoistureMin: zonesTable.targetMoistureMin,
      targetMoistureMax: zonesTable.targetMoistureMax,
      pumpId: pumpsTable.id,
      pumpStatus: pumpsTable.status,
      pumpOverride: pumpsTable.isManualOverride,
      lastIrrigated: zonesTable.lastIrrigated,
      waterRetention: soilTypesTable.waterRetentionCapacity,
    })
    .from(zonesTable)
    .leftJoin(cropsTable, eq(zonesTable.cropId, cropsTable.id))
    .leftJoin(soilTypesTable, eq(zonesTable.soilTypeId, soilTypesTable.id))
    .leftJoin(pumpsTable, eq(pumpsTable.zoneId, zonesTable.id));

  const result = zones.map((z) => {
    const rec = computeRecommendation(z.currentMoisture, z.targetMoistureMin, z.targetMoistureMax, z.waterRetention ?? 0.5, rainProb);
    return {
      id: z.id,
      name: z.name,
      cropId: z.cropId,
      cropName: z.cropName ?? "Unknown",
      soilTypeId: z.soilTypeId,
      soilTypeName: z.soilTypeName ?? "Unknown",
      currentMoisture: z.currentMoisture,
      targetMoistureMin: z.targetMoistureMin,
      targetMoistureMax: z.targetMoistureMax,
      pumpId: z.pumpId ?? 0,
      pumpStatus: pumpStatusForZone(z.pumpStatus, z.pumpOverride ?? false),
      lastIrrigated: z.lastIrrigated?.toISOString() ?? null,
      status: zoneStatus(z.currentMoisture, z.targetMoistureMin, z.targetMoistureMax, false),
      recommendation: rec.recommendation,
      recommendationReasoning: rec.reasoning,
      suggestedDurationMinutes: rec.suggestedDurationMinutes,
    };
  });

  res.json(GetZonesResponse.parse(result));
});

router.get("/zones/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetZoneParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rainProb = await getLatestRainProb();

  const [z] = await db
    .select({
      id: zonesTable.id,
      name: zonesTable.name,
      cropId: zonesTable.cropId,
      cropName: cropsTable.name,
      soilTypeId: zonesTable.soilTypeId,
      soilTypeName: soilTypesTable.name,
      currentMoisture: zonesTable.currentMoisture,
      targetMoistureMin: zonesTable.targetMoistureMin,
      targetMoistureMax: zonesTable.targetMoistureMax,
      pumpId: pumpsTable.id,
      pumpStatus: pumpsTable.status,
      pumpOverride: pumpsTable.isManualOverride,
      lastIrrigated: zonesTable.lastIrrigated,
      waterRetention: soilTypesTable.waterRetentionCapacity,
    })
    .from(zonesTable)
    .leftJoin(cropsTable, eq(zonesTable.cropId, cropsTable.id))
    .leftJoin(soilTypesTable, eq(zonesTable.soilTypeId, soilTypesTable.id))
    .leftJoin(pumpsTable, eq(pumpsTable.zoneId, zonesTable.id))
    .where(eq(zonesTable.id, params.data.id));

  if (!z) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }

  const rec = computeRecommendation(z.currentMoisture, z.targetMoistureMin, z.targetMoistureMax, z.waterRetention ?? 0.5, rainProb);

  res.json(GetZoneResponse.parse({
    id: z.id,
    name: z.name,
    cropId: z.cropId,
    cropName: z.cropName ?? "Unknown",
    soilTypeId: z.soilTypeId,
    soilTypeName: z.soilTypeName ?? "Unknown",
    currentMoisture: z.currentMoisture,
    targetMoistureMin: z.targetMoistureMin,
    targetMoistureMax: z.targetMoistureMax,
    pumpId: z.pumpId ?? 0,
    pumpStatus: pumpStatusForZone(z.pumpStatus, z.pumpOverride ?? false),
    lastIrrigated: z.lastIrrigated?.toISOString() ?? null,
    status: zoneStatus(z.currentMoisture, z.targetMoistureMin, z.targetMoistureMax, false),
    recommendation: rec.recommendation,
    recommendationReasoning: rec.reasoning,
    suggestedDurationMinutes: rec.suggestedDurationMinutes,
  }));
});

router.patch("/zones/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateZoneParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateZoneBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Partial<typeof zonesTable.$inferInsert> = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.cropId !== undefined) updateData.cropId = body.data.cropId;
  if (body.data.soilTypeId !== undefined) updateData.soilTypeId = body.data.soilTypeId;
  if (body.data.targetMoistureMin !== undefined) updateData.targetMoistureMin = body.data.targetMoistureMin;
  if (body.data.targetMoistureMax !== undefined) updateData.targetMoistureMax = body.data.targetMoistureMax;

  const [updated] = await db
    .update(zonesTable)
    .set(updateData)
    .where(eq(zonesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }

  const rainProb = await getLatestRainProb();

  const [z] = await db
    .select({
      id: zonesTable.id,
      name: zonesTable.name,
      cropId: zonesTable.cropId,
      cropName: cropsTable.name,
      soilTypeId: zonesTable.soilTypeId,
      soilTypeName: soilTypesTable.name,
      currentMoisture: zonesTable.currentMoisture,
      targetMoistureMin: zonesTable.targetMoistureMin,
      targetMoistureMax: zonesTable.targetMoistureMax,
      pumpId: pumpsTable.id,
      pumpStatus: pumpsTable.status,
      pumpOverride: pumpsTable.isManualOverride,
      lastIrrigated: zonesTable.lastIrrigated,
      waterRetention: soilTypesTable.waterRetentionCapacity,
    })
    .from(zonesTable)
    .leftJoin(cropsTable, eq(zonesTable.cropId, cropsTable.id))
    .leftJoin(soilTypesTable, eq(zonesTable.soilTypeId, soilTypesTable.id))
    .leftJoin(pumpsTable, eq(pumpsTable.zoneId, zonesTable.id))
    .where(eq(zonesTable.id, params.data.id));

  const rec = computeRecommendation(z!.currentMoisture, z!.targetMoistureMin, z!.targetMoistureMax, z!.waterRetention ?? 0.5, rainProb);

  res.json(UpdateZoneResponse.parse({
    id: z!.id,
    name: z!.name,
    cropId: z!.cropId,
    cropName: z!.cropName ?? "Unknown",
    soilTypeId: z!.soilTypeId,
    soilTypeName: z!.soilTypeName ?? "Unknown",
    currentMoisture: z!.currentMoisture,
    targetMoistureMin: z!.targetMoistureMin,
    targetMoistureMax: z!.targetMoistureMax,
    pumpId: z!.pumpId ?? 0,
    pumpStatus: pumpStatusForZone(z!.pumpStatus, z!.pumpOverride ?? false),
    lastIrrigated: z!.lastIrrigated?.toISOString() ?? null,
    status: zoneStatus(z!.currentMoisture, z!.targetMoistureMin, z!.targetMoistureMax, false),
    recommendation: rec.recommendation,
    recommendationReasoning: rec.reasoning,
    suggestedDurationMinutes: rec.suggestedDurationMinutes,
  }));
});

router.get("/zones/:id/moisture-trend", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetZoneMoistureTrendParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetZoneMoistureTrendQueryParams.safeParse(req.query);
  const hours = query.success ? (query.data.hours ?? 24) : 24;

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const readings = await db
    .select({ recordedAt: sensorReadingsTable.recordedAt, moisture: sensorReadingsTable.moisture })
    .from(sensorReadingsTable)
    .where(
      sql`${sensorReadingsTable.zoneId} = ${params.data.id} AND ${sensorReadingsTable.recordedAt} >= ${cutoff}`
    )
    .orderBy(sensorReadingsTable.recordedAt);

  const result = readings
    .filter((r) => r.moisture !== null)
    .map((r) => ({
      timestamp: r.recordedAt.toISOString(),
      moisture: r.moisture!,
    }));

  res.json(GetZoneMoistureTrendResponse.parse(result));
});

export default router;
