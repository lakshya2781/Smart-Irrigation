import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, sensorReadingsTable, zonesTable, pumpsTable } from "@workspace/db";
import {
  GetLatestSensorReadingsResponse,
  GetSensorHistoryQueryParams,
  GetSensorHistoryResponse,
  IngestEsp32DataBody,
  IngestEsp32DataResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sensors/latest", async (_req, res): Promise<void> => {
  // Get all zones with their current moisture
  const zones = await db
    .select({
      id: zonesTable.id,
      name: zonesTable.name,
      currentMoisture: zonesTable.currentMoisture,
    })
    .from(zonesTable);

  // Get latest global reading
  const [latest] = await db
    .select()
    .from(sensorReadingsTable)
    .where(sql`${sensorReadingsTable.zoneId} IS NULL`)
    .orderBy(desc(sensorReadingsTable.recordedAt))
    .limit(1);

  const zoneReadings = zones.map((z) => {
    const moisture = z.currentMoisture;
    let status: "optimal" | "dry" | "wet" | "waterlogged" | "unknown" = "optimal";
    if (moisture < 30) status = "dry";
    else if (moisture > 80) status = "wet";

    return {
      zoneId: z.id,
      zoneName: z.name,
      moisture,
      status,
    };
  });

  res.json(GetLatestSensorReadingsResponse.parse({
    zones: zoneReadings,
    temperature: latest?.temperature ?? 24.5,
    humidity: latest?.humidity ?? 65,
    tankLevelPercent: latest?.tankLevelPercent ?? 78,
    waterLoggingDetected: latest?.waterLoggingDetected ?? false,
    timestamp: (latest?.recordedAt ?? new Date()).toISOString(),
  }));
});

router.get("/sensors/history", async (req, res): Promise<void> => {
  const query = GetSensorHistoryQueryParams.safeParse(req.query);
  const hours = query.success ? (query.data.hours ?? 24) : 24;
  const zoneId = query.success ? query.data.zoneId : undefined;

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const conditions = [sql`${sensorReadingsTable.recordedAt} >= ${cutoff}`];
  if (zoneId) {
    conditions.push(sql`${sensorReadingsTable.zoneId} = ${zoneId}`);
  }

  const readings = await db
    .select()
    .from(sensorReadingsTable)
    .where(sql`${conditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} AND ${b}`)}`)
    .orderBy(desc(sensorReadingsTable.recordedAt))
    .limit(500);

  const result = readings.map((r) => ({
    id: r.id,
    zoneId: r.zoneId,
    moisture: r.moisture,
    temperature: r.temperature,
    humidity: r.humidity,
    tankLevelPercent: r.tankLevelPercent,
    waterLoggingDetected: r.waterLoggingDetected,
    recordedAt: r.recordedAt.toISOString(),
  }));

  res.json(GetSensorHistoryResponse.parse(result));
});

router.post("/esp32/ingest", async (req, res): Promise<void> => {
  const body = IngestEsp32DataBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const data = body.data;

  // Store global reading (temperature, humidity, tank)
  await db.insert(sensorReadingsTable).values({
    temperature: data.temperature,
    humidity: data.humidity,
    tankLevelPercent: data.tankLevel,
    waterLoggingDetected: data.waterLogging,
  });

  // Store per-zone moisture readings and update zone current moisture
  const moistureValues = [data.moisture1, data.moisture2, data.moisture3, data.moisture4];
  const zones = await db.select({ id: zonesTable.id }).from(zonesTable).orderBy(zonesTable.id).limit(4);

  const pumpCommands: { pumpId: number; action: string }[] = [];

  for (let i = 0; i < zones.length && i < moistureValues.length; i++) {
    const zone = zones[i];
    const moisture = moistureValues[i];

    await db.insert(sensorReadingsTable).values({
      zoneId: zone.id,
      moisture,
    });

    // Update zone current moisture
    const [updatedZone] = await db
      .update(zonesTable)
      .set({ currentMoisture: moisture })
      .where(sql`${zonesTable.id} = ${zone.id}`)
      .returning();

    // AI decision: check if pump should run
    if (updatedZone) {
      const [pump] = await db
        .select()
        .from(pumpsTable)
        .where(sql`${pumpsTable.zoneId} = ${zone.id}`)
        .limit(1);

      if (pump && !pump.isManualOverride) {
        if (moisture < updatedZone.targetMoistureMin) {
          pumpCommands.push({ pumpId: pump.id, action: "on" });
        } else if (moisture > updatedZone.targetMoistureMax) {
          pumpCommands.push({ pumpId: pump.id, action: "off" });
        }
      }
    }
  }

  res.json(IngestEsp32DataResponse.parse({
    success: true,
    pumpCommands,
    message: "Data ingested successfully",
  }));
});

export default router;
