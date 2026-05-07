import { Router, type IRouter } from "express";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { db, cropHealthTable, zonesTable, cropsTable, sensorReadingsTable, weatherCacheTable } from "@workspace/db";
import { GetCropHealthResponse, GetCropHealthHistoryResponse, GetCropHealthHistoryQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function computeZoneHealth(zoneId: number, zoneName: string, moisture: number, targetMin: number, targetMax: number, temperature: number) {
  const moistureDeficit = Math.max(0, targetMin - moisture);
  const moistureExcess = Math.max(0, moisture - targetMax);

  const ndvi = Math.max(0.2, Math.min(0.95, 0.7 - moistureDeficit * 0.008 - moistureExcess * 0.005 + (Math.random() - 0.5) * 0.04));
  const soilHealthIndex = Math.max(30, Math.min(100, 80 - moistureDeficit * 0.6 - moistureExcess * 0.4 + (Math.random() - 0.5) * 5));
  const waterStressLevel = Math.max(0, Math.min(100, moistureDeficit * 1.5 + (temperature > 35 ? (temperature - 35) * 2 : 0)));
  const growthRate = Math.max(20, Math.min(100, 88 - moistureDeficit * 0.7 - moistureExcess * 0.5 + (Math.random() - 0.5) * 6));

  const riskDrought = Math.min(95, moistureDeficit * 1.8 + (temperature > 38 ? 20 : 0));
  const riskOverwatering = Math.min(95, moistureExcess * 1.5);
  const riskDisease = Math.min(95, moistureExcess * 0.8 + (temperature > 32 ? 5 : 0) + (Math.random() * 10));

  let overallStatus: "good" | "moderate" | "critical";
  if (waterStressLevel > 60 || riskDrought > 70 || riskOverwatering > 70) overallStatus = "critical";
  else if (waterStressLevel > 30 || riskDrought > 40 || riskOverwatering > 40) overallStatus = "moderate";
  else overallStatus = "good";

  let predictionText: string;
  if (overallStatus === "critical") {
    predictionText = `Zone ${zoneName} is under significant stress. Immediate intervention required — moisture is ${moisture.toFixed(1)}% vs target ${targetMin}–${targetMax}%.`;
  } else if (overallStatus === "moderate") {
    predictionText = `Zone ${zoneName} shows moderate stress indicators. Monitor closely and adjust irrigation schedule within 48 hours.`;
  } else {
    predictionText = `Zone ${zoneName} is in good health. Current moisture ${moisture.toFixed(1)}% is within the optimal range. Continue regular irrigation schedule.`;
  }

  return {
    zoneId,
    zoneName,
    ndvi: Math.round(ndvi * 1000) / 1000,
    soilHealthIndex: Math.round(soilHealthIndex * 10) / 10,
    waterStressLevel: Math.round(waterStressLevel * 10) / 10,
    growthRate: Math.round(growthRate * 10) / 10,
    overallStatus,
    predictionText,
    riskDrought: Math.round(riskDrought * 10) / 10,
    riskOverwatering: Math.round(riskOverwatering * 10) / 10,
    riskDisease: Math.round(riskDisease * 10) / 10,
    recordedAt: new Date().toISOString(),
  };
}

router.get("/crop-health", async (_req, res): Promise<void> => {
  const zones = await db
    .select({
      id: zonesTable.id,
      name: zonesTable.name,
      currentMoisture: zonesTable.currentMoisture,
      targetMoistureMin: zonesTable.targetMoistureMin,
      targetMoistureMax: zonesTable.targetMoistureMax,
    })
    .from(zonesTable);

  const [weather] = await db
    .select({ temperature: weatherCacheTable.temperature })
    .from(weatherCacheTable)
    .orderBy(desc(weatherCacheTable.recordedAt))
    .limit(1);

  const temp = weather?.temperature ?? 28;

  const metrics = await Promise.all(
    zones.map((z) => computeZoneHealth(z.id, z.name, z.currentMoisture, z.targetMoistureMin, z.targetMoistureMax, temp))
  );

  res.json(GetCropHealthResponse.parse(metrics));
});

router.get("/crop-health/history", async (req, res): Promise<void> => {
  const query = GetCropHealthHistoryQueryParams.safeParse(req.query);
  const days = query.success ? (query.data.days ?? 30) : 30;
  const zoneId = query.success ? query.data.zoneId : undefined;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const conditions = [gte(cropHealthTable.recordedAt, cutoff)];
  if (zoneId) conditions.push(eq(cropHealthTable.zoneId, zoneId));

  const records = await db
    .select({
      id: cropHealthTable.id,
      zoneId: cropHealthTable.zoneId,
      ndvi: cropHealthTable.ndvi,
      soilHealthIndex: cropHealthTable.soilHealthIndex,
      waterStressLevel: cropHealthTable.waterStressLevel,
      growthRate: cropHealthTable.growthRate,
      overallStatus: cropHealthTable.overallStatus,
      recordedAt: cropHealthTable.recordedAt,
      zoneName: zonesTable.name,
    })
    .from(cropHealthTable)
    .leftJoin(zonesTable, eq(cropHealthTable.zoneId, zonesTable.id))
    .where(and(...conditions))
    .orderBy(desc(cropHealthTable.recordedAt))
    .limit(200);

  res.json(GetCropHealthHistoryResponse.parse(
    records.map((r) => ({
      id: r.id,
      zoneId: r.zoneId,
      zoneName: r.zoneName ?? "All Zones",
      ndvi: r.ndvi,
      soilHealthIndex: r.soilHealthIndex,
      waterStressLevel: r.waterStressLevel,
      growthRate: r.growthRate,
      overallStatus: r.overallStatus,
      recordedAt: r.recordedAt.toISOString(),
    }))
  ));
});

export default router;
