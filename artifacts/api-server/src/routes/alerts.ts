import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { broadcast } from "../lib/broadcaster";
import {
  GetAlertsQueryParams,
  GetAlertsResponse,
  AcknowledgeAlertParams,
  AcknowledgeAlertResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatAlert(a: {
  id: number;
  type: string;
  severity: string;
  message: string;
  zoneId: number | null;
  acknowledged: boolean;
  createdAt: Date;
  acknowledgedAt: Date | null;
}) {
  return {
    id: a.id,
    type: a.type as "tank_empty" | "water_logging" | "sensor_anomaly" | "pump_failure" | "low_moisture" | "high_moisture" | "weather_update" | "crop_health" | "irrigation_complete",
    severity: a.severity as "info" | "warning" | "critical",
    message: a.message,
    zoneId: a.zoneId,
    acknowledged: a.acknowledged,
    createdAt: a.createdAt.toISOString(),
    acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
  };
}

router.get("/alerts", async (req, res): Promise<void> => {
  // Handle boolean query param manually — zod.coerce.boolean() treats "false" as true
  let acknowledgedFilter: boolean | undefined;
  if (req.query.acknowledged !== undefined) {
    acknowledgedFilter = req.query.acknowledged === "true";
  }

  let alerts;
  if (acknowledgedFilter !== undefined) {
    alerts = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.acknowledged, acknowledgedFilter))
      .orderBy(desc(alertsTable.createdAt));
  } else {
    alerts = await db
      .select()
      .from(alertsTable)
      .orderBy(desc(alertsTable.createdAt));
  }

  res.json(GetAlertsResponse.parse(alerts.map(formatAlert)));
});

router.patch("/alerts/:id/acknowledge", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AcknowledgeAlertParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [alert] = await db
    .update(alertsTable)
    .set({ acknowledged: true, acknowledgedAt: new Date() })
    .where(eq(alertsTable.id, params.data.id))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  const formatted = formatAlert(alert);
  broadcast({ type: "alert_acknowledged", data: { id: alert.id } });
  res.json(AcknowledgeAlertResponse.parse(formatted));
});

export default router;
