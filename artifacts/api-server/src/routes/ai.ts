import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, zonesTable, cropsTable, soilTypesTable, pumpsTable, weatherCacheTable } from "@workspace/db";
import { GetAiRecommendationsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ai/recommendations", async (_req, res): Promise<void> => {
  // Get latest weather
  const [weather] = await db
    .select()
    .from(weatherCacheTable)
    .orderBy(desc(weatherCacheTable.recordedAt))
    .limit(1);

  const rainProb = weather?.rainProbability ?? 40;

  // Get all zones with crop and soil info
  const zones = await db
    .select({
      id: zonesTable.id,
      name: zonesTable.name,
      currentMoisture: zonesTable.currentMoisture,
      targetMoistureMin: zonesTable.targetMoistureMin,
      targetMoistureMax: zonesTable.targetMoistureMax,
      cropName: cropsTable.name,
      idealMoistureMin: cropsTable.idealMoistureMin,
      idealMoistureMax: cropsTable.idealMoistureMax,
      waterRetention: soilTypesTable.waterRetentionCapacity,
      pumpId: pumpsTable.id,
    })
    .from(zonesTable)
    .leftJoin(cropsTable, eq(zonesTable.cropId, cropsTable.id))
    .leftJoin(soilTypesTable, eq(zonesTable.soilTypeId, soilTypesTable.id))
    .leftJoin(pumpsTable, eq(pumpsTable.zoneId, zonesTable.id));

  // AI decision logic based on rain probability
  let overallDecision: "irrigate_full" | "irrigate_partial" | "skip_rain" | "skip_wet";
  let overallReasoning: string;

  if (rainProb >= 90) {
    overallDecision = "skip_rain";
    overallReasoning = `Rain probability is ${rainProb}% — skipping irrigation entirely to avoid overwatering and waterlogging.`;
  } else if (rainProb >= 50) {
    overallDecision = "irrigate_partial";
    overallReasoning = `Rain probability is ${rainProb}% — recommending partial irrigation on dry zones only. Natural rainfall will supplement.`;
  } else {
    overallDecision = "irrigate_full";
    overallReasoning = `Rain probability is ${rainProb}% — low rain expected. Full irrigation recommended based on soil moisture levels.`;
  }

  const zoneRecommendations = zones.map((z) => {
    const moisture = z.currentMoisture;
    const min = z.targetMoistureMin;
    const max = z.targetMoistureMax;
    const retention = z.waterRetention ?? 0.5;

    let recommendation: "irrigate" | "skip" | "monitor";
    let reasoning: string;
    let suggestedDurationMinutes = 0;

    if (rainProb >= 90) {
      recommendation = "skip";
      reasoning = "High rain probability negates irrigation need.";
    } else if (moisture < min - 5) {
      if (rainProb >= 50) {
        recommendation = "monitor";
        reasoning = `Moisture at ${moisture.toFixed(1)}% is below threshold but moderate rain expected. Monitor for 2 hours.`;
        suggestedDurationMinutes = 0;
      } else {
        recommendation = "irrigate";
        const deficit = max - moisture;
        suggestedDurationMinutes = Math.round((deficit / 10) * (1 - retention) * 30 + 10);
        reasoning = `Soil moisture at ${moisture.toFixed(1)}% is below minimum (${min}%). Estimated ${suggestedDurationMinutes} min irrigation needed.`;
      }
    } else if (moisture > max + 5) {
      recommendation = "skip";
      reasoning = `Soil moisture at ${moisture.toFixed(1)}% exceeds maximum (${max}%). No irrigation needed — risk of waterlogging.`;
    } else {
      recommendation = "monitor";
      reasoning = `Moisture at ${moisture.toFixed(1)}% is within optimal range (${min}%–${max}%). Monitor and irrigate if it drops.`;
    }

    return {
      zoneId: z.id,
      zoneName: z.name,
      recommendation,
      reasoning,
      suggestedDurationMinutes,
    };
  });

  res.json(GetAiRecommendationsResponse.parse({
    overallDecision,
    reasoning: overallReasoning,
    rainProbabilityFactor: rainProb,
    zones: zoneRecommendations,
    generatedAt: new Date().toISOString(),
  }));
});

export default router;
