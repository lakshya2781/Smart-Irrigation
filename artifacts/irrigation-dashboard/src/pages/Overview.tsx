import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useGetDashboardSummary,
  useGetLatestSensorReadings,
  useGetAlerts,
  useGetPumps,
  useGetCurrentWeather,
  getGetDashboardSummaryQueryKey,
  getGetLatestSensorReadingsQueryKey,
  getGetAlertsQueryKey,
  getGetPumpsQueryKey,
  getGetCurrentWeatherQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  sub,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{value}</span>
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

function MoistureBar({ name, value, min, max, status }: { name: string; value: number; min: number; max: number; status: string }) {
  const color =
    status === "optimal" ? "bg-primary" :
    status === "dry" ? "bg-amber-500" :
    status === "waterlogged" ? "bg-blue-500" : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{value.toFixed(1)}%</span>
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              status === "optimal" ? "bg-primary/20 text-primary border-primary/30" :
              status === "dry" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
              "bg-red-500/20 text-red-400 border-red-500/30"
            )}
            variant="outline"
          >
            {status}
          </Badge>
        </div>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, value)}%` }}
        />
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

  const summary = useGetDashboardSummary();
  const sensors = useGetLatestSensorReadings();
  const alerts = useGetAlerts({ acknowledged: false });
  const pumps = useGetPumps();
  const weather = useGetCurrentWeather();

  const isLoading = summary.isLoading;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold text-foreground">System Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time monitoring — refreshes every 15 seconds</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
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
              color={
                (summary.data?.tankLevelPercent ?? 100) < 20
                  ? "bg-red-500/15 text-red-400"
                  : "bg-blue-500/15 text-blue-400"
              }
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
                (summary.data?.rainProbability ?? 0) >= 90
                  ? "bg-blue-500/15 text-blue-400"
                  : (summary.data?.rainProbability ?? 0) >= 50
                  ? "bg-sky-500/15 text-sky-400"
                  : "bg-muted text-muted-foreground"
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
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          pump.status === "on" ? "bg-primary animate-pulse-green" :
                          pump.status === "override" ? "bg-amber-400 animate-pulse" :
                          "bg-muted-foreground"
                        )}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{pump.name}</div>
                        <div className="text-[10px] text-muted-foreground">{pump.driverChannel}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto text-[10px] px-1.5 py-0 h-4",
                          pump.status === "on" ? "text-primary border-primary/40" :
                          pump.status === "override" ? "text-amber-400 border-amber-400/40" :
                          "text-muted-foreground"
                        )}
                      >
                        {pump.status.toUpperCase()}
                      </Badge>
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
                <Badge variant="destructive" className="text-[10px]">
                  {alerts.data?.length}
                </Badge>
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
              (alerts.data ?? []).slice(0, 4).map((alert) => (
                <div key={alert.id} className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  alert.severity === "critical" ? "border-red-500/30 bg-red-500/5" :
                  alert.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" :
                  "border-border bg-card"
                )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircle className={cn("w-3 h-3", alert.severity === "critical" ? "text-red-400" : "text-amber-400")} />
                    <span className="font-medium capitalize">{alert.type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-muted-foreground leading-tight line-clamp-2">{alert.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone Moisture */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Droplets className="w-4 h-4 text-primary" />
            Zone Soil Moisture
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

      {/* Weather */}
      {weather.data && (
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wind className="w-4 h-4 text-sky-400" />
              Current Weather — {weather.data.location}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div><span className="text-muted-foreground block mb-1">Temperature</span><span className="font-semibold">{weather.data.temperature}°C</span></div>
              <div><span className="text-muted-foreground block mb-1">Humidity</span><span className="font-semibold">{weather.data.humidity}%</span></div>
              <div><span className="text-muted-foreground block mb-1">Wind</span><span className="font-semibold">{weather.data.windSpeed} km/h</span></div>
              <div><span className="text-muted-foreground block mb-1">Conditions</span><span className="font-semibold">{weather.data.description}</span></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
