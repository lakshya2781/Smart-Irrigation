import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pumpsTable, zonesTable, irrigationLogsTable } from "@workspace/db";
import {
  GetPumpsResponse,
  ControlPumpParams,
  ControlPumpBody,
  ControlPumpResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPump(p: {
  id: number;
  name: string;
  zoneId: number;
  zoneName: string | null;
  status: string;
  isManualOverride: boolean;
  driverChannel: string;
  runtimeToday: number;
  lastToggled: Date | null;
}) {
  return {
    id: p.id,
    name: p.name,
    zoneId: p.zoneId,
    zoneName: p.zoneName ?? "Unknown",
    status: p.status as "on" | "off" | "override",
    isManualOverride: p.isManualOverride,
    driverChannel: p.driverChannel,
    runtimeToday: p.runtimeToday,
    lastToggled: p.lastToggled?.toISOString() ?? null,
  };
}

router.get("/pumps", async (_req, res): Promise<void> => {
  const pumps = await db
    .select({
      id: pumpsTable.id,
      name: pumpsTable.name,
      zoneId: pumpsTable.zoneId,
      zoneName: zonesTable.name,
      status: pumpsTable.status,
      isManualOverride: pumpsTable.isManualOverride,
      driverChannel: pumpsTable.driverChannel,
      runtimeToday: pumpsTable.runtimeToday,
      lastToggled: pumpsTable.lastToggled,
    })
    .from(pumpsTable)
    .leftJoin(zonesTable, eq(pumpsTable.zoneId, zonesTable.id));

  res.json(GetPumpsResponse.parse(pumps.map(formatPump)));
});

router.post("/pumps/:id/control", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ControlPumpParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ControlPumpBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const action = body.data.action;
  const isOverride = body.data.isOverride ?? false;

  let newStatus: "on" | "off" | "override" = "off";
  let isManualOverride = false;
  if (action === "on") {
    newStatus = isOverride ? "override" : "on";
    isManualOverride = isOverride;
  } else if (action === "off") {
    newStatus = "off";
    isManualOverride = false;
  } else if (action === "auto") {
    newStatus = "off";
    isManualOverride = false;
  }

  const [pump] = await db
    .update(pumpsTable)
    .set({ status: newStatus, isManualOverride, lastToggled: new Date() })
    .where(eq(pumpsTable.id, params.data.id))
    .returning();

  if (!pump) {
    res.status(404).json({ error: "Pump not found" });
    return;
  }

  // Log the irrigation action
  const trigger = isOverride ? "override" : "manual";
  const logAction = action === "off" || action === "auto" ? "stopped" : "started";

  await db.insert(irrigationLogsTable).values({
    zoneId: pump.zoneId,
    pumpId: pump.id,
    action: logAction,
    trigger,
  });

  // Update zone last irrigated if pump turned on
  if (newStatus === "on" || newStatus === "override") {
    await db
      .update(zonesTable)
      .set({ lastIrrigated: new Date() })
      .where(eq(zonesTable.id, pump.zoneId));
  }

  const [updatedWithZone] = await db
    .select({
      id: pumpsTable.id,
      name: pumpsTable.name,
      zoneId: pumpsTable.zoneId,
      zoneName: zonesTable.name,
      status: pumpsTable.status,
      isManualOverride: pumpsTable.isManualOverride,
      driverChannel: pumpsTable.driverChannel,
      runtimeToday: pumpsTable.runtimeToday,
      lastToggled: pumpsTable.lastToggled,
    })
    .from(pumpsTable)
    .leftJoin(zonesTable, eq(pumpsTable.zoneId, zonesTable.id))
    .where(eq(pumpsTable.id, params.data.id));

  res.json(ControlPumpResponse.parse(formatPump(updatedWithZone!)));
});

export default router;
