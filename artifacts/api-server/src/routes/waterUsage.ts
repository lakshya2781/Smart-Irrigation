import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, irrigationLogsTable, zonesTable } from "@workspace/db";
import {
  GetWaterUsageStatsQueryParams,
  GetWaterUsageStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/water-usage/stats", async (req, res): Promise<void> => {
  const query = GetWaterUsageStatsQueryParams.safeParse(req.query);
  const days = query.success ? (query.data.days ?? 7) : 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await db
    .select({
      id: irrigationLogsTable.id,
      zoneId: irrigationLogsTable.zoneId,
      zoneName: zonesTable.name,
      action: irrigationLogsTable.action,
      durationSeconds: irrigationLogsTable.durationSeconds,
      createdAt: irrigationLogsTable.createdAt,
    })
    .from(irrigationLogsTable)
    .leftJoin(zonesTable, eq(irrigationLogsTable.zoneId, zonesTable.id))
    .where(sql`${irrigationLogsTable.createdAt} >= ${cutoff} AND ${irrigationLogsTable.action} = 'stopped'`)
    .orderBy(irrigationLogsTable.createdAt);

  // Group by date
  const byDate = new Map<string, typeof logs>();
  for (const log of logs) {
    const date = log.createdAt.toISOString().split("T")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(log);
  }

  // Fill in all days (even if no data)
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const dayLogs = byDate.get(dateStr) ?? [];

    const totalMinutes = dayLogs.reduce((sum, l) => sum + Math.round((l.durationSeconds ?? 0) / 60), 0);
    // Rough estimate: 2 liters per minute per pump
    const totalLiters = totalMinutes * 2;

    // Zone breakdown
    const zoneMap = new Map<number, { id: number; name: string; minutes: number }>();
    for (const log of dayLogs) {
      const zId = log.zoneId;
      const zName = log.zoneName ?? "Unknown";
      if (!zoneMap.has(zId)) zoneMap.set(zId, { id: zId, name: zName, minutes: 0 });
      zoneMap.get(zId)!.minutes += Math.round((log.durationSeconds ?? 0) / 60);
    }

    result.push({
      date: dateStr,
      totalLiters,
      totalMinutes,
      sessionCount: dayLogs.length,
      zoneBreakdown: Array.from(zoneMap.values()).map((z) => ({
        zoneId: z.id,
        zoneName: z.name,
        liters: z.minutes * 2,
      })),
    });
  }

  res.json(GetWaterUsageStatsResponse.parse(result));
});

export default router;
