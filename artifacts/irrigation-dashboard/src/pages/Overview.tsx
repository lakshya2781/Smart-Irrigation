import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useGetDashboardSummary,
  useGetLatestSensorReadings,
  useGetAlerts,
  useGetPumps,
  useGetCurrentWeather,
  useGetSensorHistory,
  getGetDashboardSummaryQueryKey,
  getGetLatestSensorReadingsQueryKey,
  getGetAlertsQueryKey,
  getGetPumpsQueryKey,
  getGetCurrentWeatherQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ReferenceArea,
} from "recharts";
import {
  Droplets,
  Thermometer,
  Wind,
  CloudRain,
  Zap,
  AlertTriangle,
  Activity,
  Gauge,
  CheckCircle2,
  XCircle,
  Cloud,
  Leaf,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const ZONE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#a855f7"];

type AlertType =
  | "tank_empty" | "water_logging" | "sensor_anomaly" | "pump_failure"
  | "low_moisture" | "high_moisture" | "weather_update" | "crop_health" | "irrigation_complete";

const alertTypeConfig: Record<AlertType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  tank_empty:           { icon: Gauge,     label: "Tank Empty",           color: "text-red-400"       },
  water_logging:        { icon: Droplets,  label: "Water Logging",        color: "text-blue-400"      },
  sensor_anomaly:       { icon: Activity,  label: "Sensor Anomaly",       color: "text-amber-400"     },
  pump_failure:         { icon: Zap,       label: "Pump Failure",         color: "text-red-400"       },
  low_moisture:         { icon: Droplets,  label: "Low Moisture",         color: "text-amber-400"     },
  high_moisture:        { icon: Droplets,  label: "High Moisture",        color: "text-blue-400"      },
  weather_update:       { icon: Cloud,     label: "Weather Update",       color: "text-sky-400"       },
  crop_health:          { icon: Leaf,      label: "Crop Health",          color: "text-primary"       },
  irrigation_complete:  { icon: Waves,     label: "Irrigation Complete",  color: "text-teal-400"      },
};

function StatCard({
  title, value, unit, icon: Icon, color, sub,
}: {
  title: string; value: string | number; unit?: string;
  icon: React.ComponentType<{ className?: string }>; color: string; sub?: string;
}) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums">{value}</span>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MoistureBar({
  name, value, min, max, status,
}: { name: string; value: number; min: number; max: number; status: string }) {
  const color =
    status === "optimal" ? "bg-primary" :
    status === "dry"     ? "bg-amber-500" :
    status === "wet" || status === "waterlogged" ? "bg-blue-500" : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{value.toFixed(1)}%</span>
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              status === "optimal" ? "bg-primary/20 text-primary border-primary/30" :
              status === "dry"     ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                     "bg-red-500/20 text-red-400 border-red-500/30"
            )}
            variant="outline"
          >{status}</Badge>
        </div>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, value)}%` }} />
        <div className="absolute top-0 h-full w-px bg-primary/40" style={{ left: `${min}%` }} />
        <div className="absolute top-0 h-full w-px bg-primary/40" style={{ left: `${max}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span className="text-primary/70">Target: {min}–{max}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold tabular-nums">{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

export default function Overview() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetLatestSensorReadingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPumpsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCurrentWeatherQueryKey() });
    }, 15000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const summary  = useGetDashboardSummary();
  const sensors  = useGetLatestSensorReadings();
  const alerts   = useGetAlerts({ acknowledged: false });
  const pumps    = useGetPumps();
  const weather  = useGetCurrentWeather();

  // 6-hour moisture trend for the mini chart
  const zone1H = useGetSensorHistory({ hours: 6, zoneId: 1 });
  const zone2H = useGetSensorHistory({ hours: 6, zoneId: 2 });
  const zone3H = useGetSensorHistory({ hours: 6, zoneId: 3 });
  const zone4H = useGetSensorHistory({ hours: 6, zoneId: 4 });

  const zoneHistories = [zone1H.data ?? [], zone2H.data ?? [], zone3H.data ?? [], zone4H.data ?? []];
  const allTs = new Set<string>();
  zoneHistories.forEach((h) => h.forEach((r) => allTs.add(r.recordedAt)));
  const moistureTrendData = Array.from(allTs)
    .sort()
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 30)) === 0)
    .map((ts) => {
      const row: Record<string, string | number> = { time: format(new Date(ts), "HH:mm") };
      zoneHistories.forEach((h, idx) => {
        const match = h.find((r) => r.recordedAt === ts);
        if (match?.moisture != null) row[`Z${idx + 1}`] = match.moisture;
      });
      return row;
    })
    .slice(-30);

  const isLoading = summary.isLoading;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold">System Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time monitoring — live via WebSocket + 15s fallback</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <StatCard
              title="Avg Soil Moisture"
              value={summary.data?.avgSoilMoisture.toFixed(1) ?? "—"}
              unit="%"
              icon={Droplets}
              color="bg-primary/15 text-primary"
              sub="Across all 4 zones"
            />
            <StatCard
              title="Water Tank"
              value={summary.data?.tankLevelPercent.toFixed(0) ?? "—"}
              unit="%"
              icon={Gauge}
              color={(summary.data?.tankLevelPercent ?? 100) < 20 ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}
              sub={(summary.data?.tankLevelPercent ?? 100) < 20 ? "Critical — refill now" : "Level adequate"}
            />
            <StatCard
              title="Temperature"
              value={summary.data?.temperature.toFixed(1) ?? "—"}
              unit="°C"
              icon={Thermometer}
              color="bg-amber-500/15 text-amber-400"
              sub={`Humidity: ${summary.data?.humidity.toFixed(0)}%`}
            />
            <StatCard
              title="Rain Probability"
              value={summary.data?.rainProbability.toFixed(0) ?? "—"}
              unit="%"
              icon={CloudRain}
              color={
                (summary.data?.rainProbability ?? 0) >= 90 ? "bg-blue-500/15 text-blue-400" :
                (summary.data?.rainProbability ?? 0) >= 50 ? "bg-sky-500/15 text-sky-400" :
                "bg-muted text-muted-foreground"
              }
              sub={
                (summary.data?.rainProbability ?? 0) >= 90 ? "Skip irrigation" :
                (summary.data?.rainProbability ?? 0) >= 50 ? "Partial irrigation" : "Full irrigation OK"
              }
            />
          </>
        )}
      </div>

      {/* Pump Status + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pump Status */}
        <Card className="lg:col-span-2 border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Pump Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {pumps.isLoading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
                : (pumps.data ?? []).map((pump) => (
                    <div
                      key={pump.id}
                      className={cn(
                        "rounded-lg border p-3 flex items-center gap-3",
                        pump.status === "on" || pump.status === "override"
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-card"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        pump.status === "on"       ? "bg-primary animate-pulse-green" :
                        pump.status === "override" ? "bg-amber-400 animate-pulse" :
                        "bg-muted-foreground"
                      )} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{pump.name}</div>
                        <div className="text-[10px] text-muted-foreground">{pump.driverChannel}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto text-[10px] px-1.5 py-0 h-4",
                          pump.status === "on"       ? "text-primary border-primary/40" :
                          pump.status === "override" ? "text-amber-400 border-amber-400/40" :
                          "text-muted-foreground"
                        )}
                      >{pump.status.toUpperCase()}</Badge>
                    </div>
                  ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-primary" />
                <span>{summary.data?.activePumps ?? 0} pumps active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Mode: </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                  {summary.data?.irrigationMode ?? "auto"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Active Alerts
              </div>
              {(alerts.data?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="text-[10px]">{alerts.data?.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.isLoading ? (
              <Skeleton className="h-20" />
            ) : (alerts.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">All clear — no active alerts</p>
              </div>
            ) : (
              (alerts.data ?? []).slice(0, 5).map((alert) => {
                const typeConf = alertTypeConfig[alert.type as AlertType] ?? alertTypeConfig.sensor_anomaly;
                const TypeIcon = typeConf.icon;
                return (
                  <div key={alert.id} className={cn(
                    "rounded-md border px-3 py-2 text-xs",
                    alert.severity === "critical" ? "border-red-500/30 bg-red-500/5"   :
                    alert.severity === "warning"  ? "border-amber-500/30 bg-amber-500/5" :
                    alert.type === "weather_update"      ? "border-sky-500/20 bg-sky-500/5"  :
                    alert.type === "crop_health"         ? "border-primary/20 bg-primary/5" :
                    alert.type === "irrigation_complete" ? "border-teal-500/20 bg-teal-500/5" :
                    "border-border bg-card"
                  )}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <TypeIcon className={cn("w-3 h-3 flex-shrink-0", typeConf.color)} />
                      <span className="font-medium">{typeConf.label}</span>
                    </div>
                    <p className="text-muted-foreground leading-tight line-clamp-2">{alert.message}</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone Moisture + Trend Chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Zone bars */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Droplets className="w-4 h-4 text-primary" />
              Zone Soil Moisture — Live
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sensors.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
              : (sensors.data?.zones ?? []).map((z) => (
                  <MoistureBar
                    key={z.zoneId}
                    name={z.zoneName}
                    value={z.moisture}
                    min={40}
                    max={70}
                    status={z.status}
                  />
                ))}
          </CardContent>
        </Card>

        {/* Moisture trend chart — last 6h */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Soil Moisture Trend — Last 6h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {zone1H.isLoading ? (
              <Skeleton className="h-[220px]" />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moistureTrendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      {[1, 2, 3, 4].map((n, i) => (
                        <linearGradient key={n} id={`ovGrad${n}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={ZONE_COLORS[i]} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={ZONE_COLORS[i]} stopOpacity={0}    />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }} />
                    <ReferenceArea y1={40} y2={70} fill="hsl(var(--primary))" fillOpacity={0.04} />
                    <ReferenceLine y={40} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.3} />
                    <ReferenceLine y={70} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.3} />
                    {[1, 2, 3, 4].map((n, i) => (
                      <Area
                        key={n}
                        type="monotone"
                        dataKey={`Z${n}`}
                        name={`Zone ${n}`}
                        stroke={ZONE_COLORS[i]}
                        strokeWidth={1.5}
                        fill={`url(#ovGrad${n})`}
                        dot={false}
                        connectNulls
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Temperature + Tank mini row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Temp / Humidity summary */}
        <Card className="border-card-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold">Temperature & Humidity — Live</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="text-[10px] text-muted-foreground mb-0.5">Temperature</div>
                <div className="text-xl font-bold text-amber-400 tabular-nums">
                  {sensors.data?.temperature?.toFixed(1) ?? "—"}<span className="text-sm ml-0.5">°C</span>
                </div>
                {sensors.data?.temperature !== undefined && sensors.data.temperature > 35 && (
                  <Badge variant="outline" className="text-[10px] mt-1 text-amber-400 border-amber-400/30 bg-amber-400/10">Heat Advisory</Badge>
                )}
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                <div className="text-[10px] text-muted-foreground mb-0.5">Humidity</div>
                <div className="text-xl font-bold text-blue-400 tabular-nums">
                  {sensors.data?.humidity?.toFixed(0) ?? "—"}<span className="text-sm ml-0.5">%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weather card */}
        {weather.data ? (
          <Card className="border-card-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wind className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold">Weather — {weather.data.location}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Conditions</span>
                  <span className="text-xs font-semibold">{weather.data.description}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Wind Speed</span>
                  <span className="text-xs font-semibold">{weather.data.windSpeed} km/h</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Rain %</span>
                  <span className="text-xs font-bold">{weather.data.rainProbability}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Tank Level</span>
                  <span className={cn(
                    "text-xs font-bold",
                    (sensors.data?.tankLevelPercent ?? 100) < 20 ? "text-red-400" : "text-blue-400"
                  )}>
                    {sensors.data?.tankLevelPercent?.toFixed(0) ?? "—"}%
                    {(sensors.data?.tankLevelPercent ?? 100) < 20 && " ⚠"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-card-border">
            <CardContent className="p-4">
              <Skeleton className="h-20" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
