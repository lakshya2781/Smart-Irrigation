import { db, sensorReadingsTable, zonesTable, pumpsTable, alertsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { broadcast } from "./broadcaster";
import { logger } from "./logger";

// Simulated state with realistic drift
const state = {
  moisture: [52, 38, 61, 45],      // per-zone
  temperature: 29.4,
  humidity: 68,
  tankLevel: 78,
  waterLogging: false,
  tick: 0,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function jitter(v: number, range: number) {
  return v + (Math.random() - 0.5) * range;
}

async function ingestSensorData() {
  // Drift moisture values
  state.moisture = state.moisture.map((m, i) => {
    let delta = (Math.random() - 0.48) * 1.2; // slight downward drift = natural evapotranspiration
    // Check pump status for this zone
    return clamp(jitter(m + delta, 0.3), 5, 98);
  });

  // Drift temperature with diurnal cycle
  const hour = new Date().getHours();
  const diurnal = Math.sin((hour - 6) * Math.PI / 12) * 4;
  state.temperature = clamp(jitter(28 + diurnal, 0.4), 18, 42);
  state.humidity = clamp(jitter(state.humidity + (Math.random() - 0.5) * 1.5, 0.2), 35, 95);
  state.tankLevel = clamp(state.tankLevel - Math.random() * 0.3, 5, 100);

  // Insert global reading
  await db.insert(sensorReadingsTable).values({
    temperature: parseFloat(state.temperature.toFixed(1)),
    humidity: parseFloat(state.humidity.toFixed(1)),
    tankLevelPercent: parseFloat(state.tankLevel.toFixed(1)),
    waterLoggingDetected: state.waterLogging,
  });

  // Get zones ordered by ID
  const zones = await db.select({ id: zonesTable.id, targetMin: zonesTable.targetMoistureMin, targetMax: zonesTable.targetMoistureMax }).from(zonesTable).orderBy(zonesTable.id).limit(4);

  for (let i = 0; i < zones.length && i < state.moisture.length; i++) {
    const zone = zones[i];
    const moisture = parseFloat(state.moisture[i].toFixed(1));

    await db.insert(sensorReadingsTable).values({ zoneId: zone.id, moisture });
    await db.update(zonesTable).set({ currentMoisture: moisture }).where(eq(zonesTable.id, zone.id));

    // Auto pump control
    const [pump] = await db.select().from(pumpsTable).where(eq(pumpsTable.zoneId, zone.id)).limit(1);
    if (pump && !pump.isManualOverride) {
      if (moisture < zone.targetMin) {
        await db.update(pumpsTable).set({ status: "on", lastToggled: new Date() }).where(eq(pumpsTable.id, pump.id));
        // Irrigation boosts moisture
        state.moisture[i] = clamp(state.moisture[i] + 0.8, 0, 95);
      } else if (moisture > zone.targetMax) {
        await db.update(pumpsTable).set({ status: "off", lastToggled: new Date() }).where(eq(pumpsTable.id, pump.id));
      }
    }
  }

  broadcast({
    type: "sensor_update",
    data: {
      zones: zones.map((z, i) => ({ zoneId: z.id, moisture: state.moisture[i] })),
      temperature: state.temperature,
      humidity: state.humidity,
      tankLevel: state.tankLevel,
    },
  });
}

async function maybeCreateAlert() {
  state.tick++;

  // Every 4 ticks (~2 min) randomly create contextual alerts
  if (state.tick % 4 !== 0) return;

  const roll = Math.random();

  if (state.tankLevel < 20 && Math.random() > 0.5) {
    await db.insert(alertsTable).values({
      type: "tank_empty",
      severity: "critical",
      message: `Water tank critically low at ${state.tankLevel.toFixed(0)}%. Irrigation will pause soon. Refill immediately.`,
      acknowledged: false,
    });
    broadcast({ type: "alert_created", data: { type: "tank_empty", severity: "critical" } });
    return;
  }

  if (roll < 0.25) {
    // Weather update
    const scenarios = [
      { msg: "Rain forecast: 72% probability of rainfall in the next 6 hours. AI engine adjusting irrigation schedule to conserve water.", sev: "info" as const },
      { msg: "Strong winds detected (28 km/h). Evapotranspiration rate increased by 18%. AI recommending increased irrigation duration.", sev: "warning" as const },
      { msg: "Heat advisory: Temperature expected to reach 38°C today. Switching to early-morning irrigation cycles to minimize evaporation.", sev: "warning" as const },
      { msg: "Ideal weather conditions: 22°C, 60% humidity, no rain expected. Proceeding with full AI-scheduled irrigation.", sev: "info" as const },
    ];
    const s = scenarios[Math.floor(Math.random() * scenarios.length)];
    await db.insert(alertsTable).values({ type: "weather_update", severity: s.sev, message: s.msg, acknowledged: false });
    broadcast({ type: "alert_created", data: { type: "weather_update", severity: s.sev } });

  } else if (roll < 0.5) {
    // Crop health
    const zoneNames = ["Zone A - North Field", "Zone B - East Field", "Zone C - South Field", "Zone D - West Field"];
    const zoneIdx = Math.floor(Math.random() * 4);
    const moisture = state.moisture[zoneIdx];
    let msg: string;
    let sev: "info" | "warning" | "critical";

    if (moisture < 30) {
      msg = `${zoneNames[zoneIdx]}: Soil moisture critically low at ${moisture.toFixed(0)}%. Crop stress risk high — wilting may occur within 12 hours without irrigation.`;
      sev = "critical";
    } else if (moisture < 42) {
      msg = `${zoneNames[zoneIdx]}: Below-optimal moisture detected (${moisture.toFixed(0)}%). Crop entering mild stress zone. Irrigation recommended within 4 hours.`;
      sev = "warning";
    } else if (moisture > 82) {
      msg = `${zoneNames[zoneIdx]}: Excess soil moisture (${moisture.toFixed(0)}%) detected. Root zone saturation risk. Pause irrigation and monitor drainage.`;
      sev = "warning";
    } else {
      msg = `${zoneNames[zoneIdx]}: Crop health check passed. Moisture at ${moisture.toFixed(0)}% — within optimal range. Growth conditions: excellent.`;
      sev = "info";
    }

    await db.insert(alertsTable).values({ type: "crop_health", severity: sev, message: msg, zoneId: zoneIdx + 1, acknowledged: false });
    broadcast({ type: "alert_created", data: { type: "crop_health", severity: sev } });

  } else if (roll < 0.75) {
    // Irrigation complete
    const zoneNames = ["Zone A - North Field", "Zone B - East Field", "Zone C - South Field", "Zone D - West Field"];
    const zoneIdx = Math.floor(Math.random() * 4);
    const duration = Math.floor(Math.random() * 20 + 8);
    const waterUsed = (duration * 14.5).toFixed(0);
    const moistureAfter = Math.min(98, state.moisture[zoneIdx] + duration * 0.9);
    await db.insert(alertsTable).values({
      type: "irrigation_complete",
      severity: "info",
      message: `Irrigation cycle complete for ${zoneNames[zoneIdx]}. Duration: ${duration} min · Water used: ${waterUsed}L · Soil moisture: ${moistureAfter.toFixed(0)}%. Next cycle scheduled in 6h.`,
      zoneId: zoneIdx + 1,
      acknowledged: false,
    });
    broadcast({ type: "alert_created", data: { type: "irrigation_complete", severity: "info" } });

  } else if (state.temperature > 35) {
    // Sensor anomaly for high temp
    await db.insert(alertsTable).values({
      type: "sensor_anomaly",
      severity: "warning",
      message: `High temperature reading: ${state.temperature.toFixed(1)}°C from DHT22 sensor. Verifying against weather API. Evapotranspiration estimate increased.`,
      acknowledged: false,
    });
    broadcast({ type: "alert_created", data: { type: "sensor_anomaly", severity: "warning" } });
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startSimulator() {
  if (intervalHandle) return;

  // Run immediately on start, then every 30 seconds
  setTimeout(async () => {
    try { await ingestSensorData(); } catch (e) { logger.error({ e }, "Simulator ingest error"); }
    try { await maybeCreateAlert(); } catch (e) { logger.error({ e }, "Simulator alert error"); }
  }, 3000);

  intervalHandle = setInterval(async () => {
    try { await ingestSensorData(); } catch (e) { logger.error({ e }, "Simulator ingest error"); }
    try { await maybeCreateAlert(); } catch (e) { logger.error({ e }, "Simulator alert error"); }
  }, 30_000);

  logger.info("ESP32 simulator started — posting sensor data every 30s");
}

export function stopSimulator() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
