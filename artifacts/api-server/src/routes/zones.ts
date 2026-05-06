import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, zonesTable, cropsTable, soilTypesTable, pumpsTable, sensorReadingsTable } from "@workspace/db";
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

router.get("/zones", async (req, res): Promise<void> => {
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
    })
    .from(zonesTable)
    .leftJoin(cropsTable, eq(zonesTable.cropId, cropsTable.id))
    .leftJoin(soilTypesTable, eq(zonesTable.soilTypeId, soilTypesTable.id))
    .leftJoin(pumpsTable, eq(pumpsTable.zoneId, zonesTable.id));

  const result = zones.map((z) => ({
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
  }));

  res.json(GetZonesResponse.parse(result));
});

router.get("/zones/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetZoneParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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
    })
    .from(zonesTable)
    .leftJoin(cropsTable, eq(zonesTable.cropId, cropsTable.id))
    .leftJoin(soilTypesTable, eq(zonesTable.soilTypeId, soilTypesTable.id))
    .leftJoin(pumpsTable, eq(pumpsTable.zoneId, zonesTable.id))
    .where(eq(zonesTable.id, params.data.id));

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
