import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, irrigationLogsTable, zonesTable, pumpsTable } from "@workspace/db";
import {
  GetIrrigationLogsQueryParams,
  GetIrrigationLogsResponse,
  CreateIrrigationLogBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatLog(log: {
  id: number;
  zoneId: number;
  zoneName: string | null;
  pumpId: number;
  action: string;
  trigger: string;
  durationSeconds: number | null;
  soilMoistureBefore: number | null;
  soilMoistureAfter: number | null;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    zoneId: log.zoneId,
    zoneName: log.zoneName ?? "Unknown",
    pumpId: log.pumpId,
    action: log.action as "started" | "stopped",
    trigger: log.trigger as "auto" | "manual" | "override" | "ai",
    durationSeconds: log.durationSeconds,
    soilMoistureBefore: log.soilMoistureBefore,
    soilMoistureAfter: log.soilMoistureAfter,
    notes: log.notes,
    createdAt: log.createdAt.toISOString(),
  };
}

router.get("/irrigation/logs", async (req, res): Promise<void> => {
  const query = GetIrrigationLogsQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 50) : 50;
  const zoneId = query.success ? query.data.zoneId : undefined;

  const conditions = [];
  if (zoneId) {
    conditions.push(sql`${irrigationLogsTable.zoneId} = ${zoneId}`);
  }

  const baseQuery = db
    .select({
      id: irrigationLogsTable.id,
      zoneId: irrigationLogsTable.zoneId,
      zoneName: zonesTable.name,
      pumpId: irrigationLogsTable.pumpId,
      action: irrigationLogsTable.action,
      trigger: irrigationLogsTable.trigger,
      durationSeconds: irrigationLogsTable.durationSeconds,
      soilMoistureBefore: irrigationLogsTable.soilMoistureBefore,
      soilMoistureAfter: irrigationLogsTable.soilMoistureAfter,
      notes: irrigationLogsTable.notes,
      createdAt: irrigationLogsTable.createdAt,
    })
    .from(irrigationLogsTable)
    .leftJoin(zonesTable, eq(irrigationLogsTable.zoneId, zonesTable.id))
    .orderBy(desc(irrigationLogsTable.createdAt))
    .limit(limit);

  const logs = conditions.length > 0
    ? await baseQuery.where(conditions[0])
    : await baseQuery;

  res.json(GetIrrigationLogsResponse.parse(logs.map(formatLog)));
});

router.post("/irrigation/logs", async (req, res): Promise<void> => {
  const body = CreateIrrigationLogBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [log] = await db.insert(irrigationLogsTable).values({
    zoneId: body.data.zoneId,
    pumpId: body.data.pumpId,
    action: body.data.action,
    trigger: body.data.trigger,
    durationSeconds: body.data.durationSeconds,
    soilMoistureBefore: body.data.soilMoistureBefore,
    soilMoistureAfter: body.data.soilMoistureAfter,
    notes: body.data.notes,
  }).returning();

  const [zone] = await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, log.zoneId));

  res.status(201).json(formatLog({ ...log, zoneName: zone?.name ?? "Unknown" }));
});

export default router;
