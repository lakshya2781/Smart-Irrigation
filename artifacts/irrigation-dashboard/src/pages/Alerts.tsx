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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const alertTypeConfig = {
  tank_empty: { icon: Gauge, label: "Tank Empty", color: "text-red-400" },
  water_logging: { icon: Droplets, label: "Water Logging", color: "text-blue-400" },
  sensor_anomaly: { icon: Activity, label: "Sensor Anomaly", color: "text-amber-400" },
  pump_failure: { icon: Zap, label: "Pump Failure", color: "text-red-400" },
  low_moisture: { icon: Droplets, label: "Low Moisture", color: "text-amber-400" },
  high_moisture: { icon: Droplets, label: "High Moisture", color: "text-blue-400" },
} as const;

const severityConfig = {
  critical: { class: "border-red-500/40 bg-red-500/5", badge: "bg-red-500/20 text-red-300 border-red-500/40" },
  warning: { class: "border-amber-500/40 bg-amber-500/5", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  info: { class: "border-border bg-card", badge: "bg-muted text-muted-foreground border-border" },
} as const;

export default function Alerts() {
  const queryClient = useQueryClient();
  const [showAcknowledged, setShowAcknowledged] = useState(false);
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

  const alertList = alerts.data ?? [];
  const criticalCount = alertList.filter((a) => a.severity === "critical" && !a.acknowledged).length;
  const warningCount = alertList.filter((a) => a.severity === "warning" && !a.acknowledged).length;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Alerts & Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">System alerts from sensors, pumps, and tank monitoring</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Critical</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{warningCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Warnings</div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{alertList.filter((a) => a.acknowledged).length}</div>
            <div className="text-xs text-muted-foreground mt-1">Acknowledged</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {alerts.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : alertList.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="py-12 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-primary" />
              <p className="text-sm text-muted-foreground">No active alerts — system operating normally</p>
            </CardContent>
          </Card>
        ) : (
          alertList.map((alert) => {
            const typeConf = alertTypeConfig[alert.type];
            const sevConf = severityConfig[alert.severity];
            const TypeIcon = typeConf.icon;

            return (
              <Card
                key={alert.id}
                className={cn("border transition-opacity", sevConf.class, alert.acknowledged && "opacity-60")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                      alert.severity === "critical" ? "bg-red-500/15" : alert.severity === "warning" ? "bg-amber-500/15" : "bg-muted"
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
                          {format(new Date(alert.createdAt), "MMM d, yyyy HH:mm")}
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
