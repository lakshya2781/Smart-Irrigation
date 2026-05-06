import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, zonesTable, pumpsTable, alertsTable, weatherCacheTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  // Get all zones for avg moisture
  const zones = await db.select({ currentMoisture: zonesTable.currentMoisture }).from(zonesTable);
  const avgMoisture = zones.length > 0
    ? zones.reduce((sum, z) => sum + z.currentMoisture, 0) / zones.length
    : 50;

  // Count active pumps
  const activePumps = await db
    .select({ count: sql<number>`count(*)` })
    .from(pumpsTable)
    .where(sql`${pumpsTable.status} IN ('on', 'override')`);

  // Count unacknowledged alerts
  const alertCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertsTable)
    .where(sql`${alertsTable.acknowledged} = false`);

  // Latest weather
  const [weather] = await db
    .select()
    .from(weatherCacheTable)
    .orderBy(desc(weatherCacheTable.recordedAt))
    .limit(1);

  // Check any pump in override mode
  const [overridePump] = await db
    .select()
    .from(pumpsTable)
    .where(sql`${pumpsTable.isManualOverride} = true`)
    .limit(1);

  const irrigationMode = overridePump ? "override" : "auto";

  res.json(GetDashboardSummaryResponse.parse({
    avgSoilMoisture: Math.round(avgMoisture * 10) / 10,
    tankLevelPercent: 78,
    temperature: weather?.temperature ?? 25,
    humidity: weather?.humidity ?? 65,
    activePumps: Number(activePumps[0]?.count ?? 0),
    activeAlerts: Number(alertCount[0]?.count ?? 0),
    rainProbability: weather?.rainProbability ?? 30,
    irrigationMode,
    waterLoggingDetected: false,
    systemStatus: "online",
    lastUpdated: new Date().toISOString(),
  }));
});

export default router;
