import { useState } from "react";
import {
  useGetAlerts,
  useAcknowledgeAlert,
  getGetAlertsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Activity,
  Zap,
  Gauge,
  Bell,
  BellOff,
  Cloud,
  Leaf,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type AlertType =
  | "tank_empty"
  | "water_logging"
  | "sensor_anomaly"
  | "pump_failure"
  | "low_moisture"
  | "high_moisture"
  | "weather_update"
  | "crop_health"
  | "irrigation_complete";

const alertTypeConfig: Record<AlertType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  tank_empty:           { icon: Gauge,          label: "Tank Empty",            color: "text-red-400" },
  water_logging:        { icon: Droplets,        label: "Water Logging",         color: "text-blue-400" },
  sensor_anomaly:       { icon: Activity,        label: "Sensor Anomaly",        color: "text-amber-400" },
  pump_failure:         { icon: Zap,             label: "Pump Failure",          color: "text-red-400" },
  low_moisture:         { icon: Droplets,        label: "Low Moisture",          color: "text-amber-400" },
  high_moisture:        { icon: Droplets,        label: "High Moisture",         color: "text-blue-400" },
  weather_update:       { icon: Cloud,           label: "Weather Update",        color: "text-sky-400" },
  crop_health:          { icon: Leaf,            label: "Crop Health",           color: "text-primary" },
  irrigation_complete:  { icon: Waves,           label: "Irrigation Complete",   color: "text-teal-400" },
};

const severityConfig = {
  critical: { class: "border-red-500/40 bg-red-500/5",       badge: "bg-red-500/20 text-red-300 border-red-500/40"         },
  warning:  { class: "border-amber-500/40 bg-amber-500/5",   badge: "bg-amber-500/20 text-amber-300 border-amber-500/40"   },
  info:     { class: "border-border bg-card",                 badge: "bg-muted text-muted-foreground border-border"         },
} as const;

const TYPE_FILTERS = [
  { value: "all",                 label: "All Types" },
  { value: "weather_update",      label: "Weather" },
  { value: "crop_health",         label: "Crop Health" },
  { value: "irrigation_complete", label: "Irrigation" },
  { value: "low_moisture",        label: "Moisture" },
  { value: "tank_empty",          label: "Tank" },
  { value: "sensor_anomaly",      label: "Sensor" },
  { value: "pump_failure",        label: "Pump" },
];

export default function Alerts() {
  const queryClient = useQueryClient();
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const alerts = useGetAlerts(showAcknowledged ? undefined : { acknowledged: false });
  const acknowledge = useAcknowledgeAlert();
  const [pending, setPending] = useState<number | null>(null);

  const handleAcknowledge = (id: number) => {
    setPending(id);
    acknowledge.mutate(
      { id },
      {
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setPending(null);
        },
      }
    );
  };

  const allAlerts = alerts.data ?? [];
  const filteredAlerts = typeFilter === "all" ? allAlerts : allAlerts.filter((a) => a.type === typeFilter);

  const criticalCount = allAlerts.filter((a) => a.severity === "critical" && !a.acknowledged).length;
  const warningCount  = allAlerts.filter((a) => a.severity === "warning"  && !a.acknowledged).length;
  const infoCount     = allAlerts.filter((a) => a.severity === "info"     && !a.acknowledged).length;

  // Group counts by category
  const weatherCount    = allAlerts.filter((a) => a.type === "weather_update"      && !a.acknowledged).length;
  const cropCount       = allAlerts.filter((a) => a.type === "crop_health"         && !a.acknowledged).length;
  const irrigCount      = allAlerts.filter((a) => a.type === "irrigation_complete" && !a.acknowledged).length;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Alerts & Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time alerts from sensors, pumps, weather, and crop health monitoring
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setShowAcknowledged((v) => !v)}
        >
          {showAcknowledged ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          {showAcknowledged ? "Hide Acknowledged" : "Show All"}
        </Button>
      </div>

      {/* Summary row — severity */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-400">{criticalCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Critical</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-amber-400">{warningCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Warnings</div>
          </CardContent>
        </Card>
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-sky-400">{weatherCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Weather</div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-primary">{cropCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Crop Health</div>
          </CardContent>
        </Card>
        <Card className="border-teal-500/30 bg-teal-500/5">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-teal-400">{irrigCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Irrigation</div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-primary">{allAlerts.filter((a) => a.acknowledged).length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Acknowledged</div>
          </CardContent>
        </Card>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs border transition-colors",
              typeFilter === f.value
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">
          {filteredAlerts.length} shown
        </span>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {alerts.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : filteredAlerts.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="py-12 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-primary" />
              <p className="text-sm text-muted-foreground">
                {typeFilter === "all" ? "No active alerts — system operating normally" : `No ${typeFilter.replace(/_/g, " ")} alerts`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const typeConf = alertTypeConfig[alert.type as AlertType] ?? alertTypeConfig.sensor_anomaly;
            const sevConf  = severityConfig[alert.severity as keyof typeof severityConfig];
            const TypeIcon = typeConf.icon;

            return (
              <Card
                key={alert.id}
                className={cn("border transition-opacity", sevConf.class, alert.acknowledged && "opacity-50")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                      alert.severity === "critical" ? "bg-red-500/15"
                        : alert.severity === "warning" ? "bg-amber-500/15"
                        : alert.type === "weather_update" ? "bg-sky-500/15"
                        : alert.type === "crop_health" ? "bg-primary/15"
                        : alert.type === "irrigation_complete" ? "bg-teal-500/15"
                        : "bg-muted"
                    )}>
                      <TypeIcon className={cn("w-4 h-4", typeConf.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold">{typeConf.label}</span>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 capitalize", sevConf.badge)}>
                          {alert.severity}
                        </Badge>
                        {alert.acknowledged && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-primary border-primary/40">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />Acknowledged
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(alert.createdAt), "MMM d, yyyy HH:mm:ss")}
                        </span>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={pending === alert.id}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {pending === alert.id ? "..." : "Acknowledge"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
