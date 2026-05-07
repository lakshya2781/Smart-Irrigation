import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetAlerts,
  useGetPumps,
  useGetCurrentWeather,
  useGetZones,
  getGetDashboardSummaryQueryKey,
  getGetAlertsQueryKey,
  getGetPumpsQueryKey,
  getGetCurrentWeatherQueryKey,
  getGetZonesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Droplets, Zap, AlertTriangle, Activity, Gauge, Cloud, Leaf,
  Waves, CheckCircle2, ArrowRight, Thermometer, Wind, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type AlertType =
  | "tank_empty" | "water_logging" | "sensor_anomaly" | "pump_failure"
  | "low_moisture" | "high_moisture" | "weather_update" | "crop_health" | "irrigation_complete";

const alertTypeConfig: Record<AlertType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  tank_empty:           { icon: Gauge,         label: "Tank Empty",           color: "text-red-400"    },
  water_logging:        { icon: Droplets,      label: "Water Logging",        color: "text-blue-400"   },
  sensor_anomaly:       { icon: Activity,      label: "Sensor Anomaly",       color: "text-amber-400"  },
  pump_failure:         { icon: Zap,           label: "Pump Failure",         color: "text-red-400"    },
  low_moisture:         { icon: Droplets,      label: "Low Moisture",         color: "text-amber-400"  },
  high_moisture:        { icon: Droplets,      label: "High Moisture",        color: "text-blue-400"   },
  weather_update:       { icon: Cloud,         label: "Weather Update",       color: "text-sky-400"    },
  crop_health:          { icon: Leaf,          label: "Crop Health",          color: "text-primary"    },
  irrigation_complete:  { icon: Waves,         label: "Irrigation Complete",  color: "text-teal-400"   },
};

function MetricCard({
  label, value, unit, icon: Icon, iconColor, sub, href,
}: {
  label: string; value: string | number; unit?: string;
  icon: React.ComponentType<{ className?: string }>; iconColor: string; sub?: string; href?: string;
}) {
  const content = (
    <CardContent className="p-5">
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {href && <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1" />}
      </div>
    </CardContent>
  );

  return (
    <Card className={cn("border-card-border", href && "hover:border-primary/30 transition-colors cursor-pointer")}>
      {href ? <Link href={href}>{content}</Link> : content}
    </Card>
  );
}

export default function Overview() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPumpsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCurrentWeatherQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetZonesQueryKey() });
    }, 15000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const summary = useGetDashboardSummary();
  const alerts  = useGetAlerts({ acknowledged: false });
  const pumps   = useGetPumps();
  const weather = useGetCurrentWeather();
  const zones   = useGetZones();

  const activePumps  = pumps.data?.filter((p) => p.status === "on" || p.status === "override").length ?? 0;
  const alertCount   = alerts.data?.length ?? 0;
  const zoneStatuses = zones.data?.map((z) => z.status) ?? [];
  const dryZones     = zoneStatuses.filter((s) => s === "dry").length;
  const wetZones     = zoneStatuses.filter((s) => s === "waterlogged" || s === "wet").length;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System summary — live via WebSocket · 15s refresh</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <MetricCard
              label="Irrigation Zones"
              value="4"
              icon={Layers}
              iconColor="bg-primary/15 text-primary"
              sub={`${dryZones > 0 ? `${dryZones} dry` : "All zones OK"}`}
              href="/zones"
            />
            <MetricCard
              label="Active Pumps"
              value={activePumps}
              unit={`/ ${pumps.data?.length ?? 4}`}
              icon={Zap}
              iconColor={activePumps > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}
              sub={summary.data?.irrigationMode === "override" ? "Manual override" : "Auto mode"}
              href="/control"
            />
            <MetricCard
              label="Active Alerts"
              value={alertCount}
              icon={AlertTriangle}
              iconColor={alertCount > 0 ? "bg-red-500/15 text-red-400" : "bg-primary/15 text-primary"}
              sub={alertCount === 0 ? "All clear" : `${alertCount} unacknowledged`}
              href="/alerts"
            />
            <MetricCard
              label="System Status"
              value={summary.data?.systemStatus === "online" ? "Online" : "Offline"}
              icon={Activity}
              iconColor={summary.data?.systemStatus === "online" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}
              sub="ESP32 · DHT22 · Simulator"
            />
          </>
        )}
      </div>

      {/* Zone quick status + Weather snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Zone status overview */}
        <Card className="lg:col-span-2 border-card-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" />
                Zone Status Overview
              </CardTitle>
              <Link href="/zones">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  Details <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {zones.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)
              : (zones.data ?? []).map((z) => (
                  <div key={z.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40 border border-border">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      z.pumpStatus === "on" ? "bg-primary animate-pulse-green" :
                      z.pumpStatus === "override" ? "bg-amber-400 animate-pulse" : "bg-muted-foreground"
                    )} />
                    <span className="text-xs font-medium flex-1">{z.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{z.currentMoisture.toFixed(1)}%</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4",
                        z.status === "optimal" ? "text-primary border-primary/40 bg-primary/10" :
                        z.status === "dry"     ? "text-amber-400 border-amber-400/40 bg-amber-400/10" :
                                                 "text-blue-400 border-blue-400/40 bg-blue-400/10"
                      )}
                    >
                      {z.status}
                    </Badge>
                    {z.recommendation && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          z.recommendation === "irrigate" ? "text-primary border-primary/40" :
                          z.recommendation === "skip"    ? "text-muted-foreground border-border" :
                                                           "text-amber-400 border-amber-400/40"
                        )}
                      >
                        {z.recommendation}
                      </Badge>
                    )}
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* Weather + pump summary */}
        <div className="space-y-3">
          <Card className="border-card-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cloud className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold">Weather Snapshot</span>
                <Link href="/ai" className="ml-auto">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                </Link>
              </div>
              {weather.isLoading ? <Skeleton className="h-16" /> : weather.data ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Thermometer className="w-3 h-3" />Temperature</span>
                    <span className="font-semibold text-amber-400">{weather.data.temperature}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Wind className="w-3 h-3" />Wind</span>
                    <span className="font-semibold">{weather.data.windSpeed} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Cloud className="w-3 h-3" />Rain %</span>
                    <span className={cn("font-semibold", (weather.data.rainProbability) >= 50 ? "text-blue-400" : "text-foreground")}>
                      {weather.data.rainProbability}%
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Pump Summary</span>
                <Link href="/control" className="ml-auto">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pumps.isLoading
                  ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)
                  : (pumps.data ?? []).map((p) => (
                      <div key={p.id} className={cn(
                        "rounded-md border px-2 py-1.5 flex items-center gap-1.5",
                        p.status === "on" || p.status === "override" ? "border-primary/30 bg-primary/5" : "border-border"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          p.status === "on" ? "bg-primary animate-pulse-green" :
                          p.status === "override" ? "bg-amber-400" : "bg-muted-foreground"
                        )} />
                        <span className="text-[10px] truncate">{p.name.split(" ").slice(0, 2).join(" ")}</span>
                        <span className={cn(
                          "text-[9px] ml-auto font-bold",
                          p.status === "on" ? "text-primary" : p.status === "override" ? "text-amber-400" : "text-muted-foreground"
                        )}>{p.status.toUpperCase()}</span>
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Alerts */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Recent Activity
              {alertCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">{alertCount}</Badge>
              )}
            </CardTitle>
            <Link href="/alerts">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.isLoading ? (
            <Skeleton className="h-20" />
          ) : (alerts.data?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-primary mb-2" />
              <p className="text-xs text-muted-foreground">No active alerts — all systems normal</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(alerts.data ?? []).slice(0, 5).map((alert) => {
                const typeConf = alertTypeConfig[alert.type as AlertType] ?? alertTypeConfig.sensor_anomaly;
                const TypeIcon = typeConf.icon;
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-xs",
                      alert.severity === "critical" ? "border-red-500/30 bg-red-500/5" :
                      alert.severity === "warning"  ? "border-amber-500/30 bg-amber-500/5" :
                      "border-border bg-muted/30"
                    )}
                  >
                    <TypeIcon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", typeConf.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium">{typeConf.label}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1 py-0 h-3.5",
                            alert.severity === "critical" ? "text-red-400 border-red-400/40" :
                            alert.severity === "warning"  ? "text-amber-400 border-amber-400/40" :
                            "text-muted-foreground"
                          )}
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-tight line-clamp-1">{alert.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
