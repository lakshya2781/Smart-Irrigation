import { useState } from "react";
import {
  useGetIrrigationLogs,
  useGetWaterUsageStats,
  useGetZones,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { History as HistoryIcon, Droplets, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const ZONE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#a855f7"];

const triggerConfig = {
  auto: "bg-primary/15 text-primary border-primary/30",
  manual: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  override: "bg-red-500/15 text-red-400 border-red-500/30",
  ai: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-sm" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function History() {
  const [days, setDays] = useState(7);
  const logs = useGetIrrigationLogs({ limit: 100 });
  const waterStats = useGetWaterUsageStats({ days });
  const zones = useGetZones();

  const zoneNames = (zones.data ?? []).map((z) => z.name.split(" - ")[0]);

  // Build stacked bar chart data from water stats
  const waterChartData = (waterStats.data ?? []).map((stat) => {
    const row: Record<string, string | number> = { date: format(new Date(stat.date + "T00:00:00"), "MMM d") };
    stat.zoneBreakdown.forEach((zb) => {
      row[zb.zoneName.split(" - ")[0]] = zb.liters;
    });
    return row;
  });

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary" />
            Historical Data & Trends
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Irrigation logs and water usage analytics</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      {waterStats.data && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {waterStats.data.reduce((s, d) => s + d.totalLiters, 0).toFixed(0)}L
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Water Used</div>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {waterStats.data.reduce((s, d) => s + d.totalMinutes, 0)}m
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Runtime</div>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {waterStats.data.reduce((s, d) => s + d.sessionCount, 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Irrigation Sessions</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Water Usage Chart */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Droplets className="w-4 h-4 text-primary" />
            Water Usage (liters) — Last {days} Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            {waterStats.isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  {zoneNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={ZONE_COLORS[i]} radius={i === zoneNames.length - 1 ? [3, 3, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Irrigation Log Table */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Irrigation Action Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.isLoading ? (
            <Skeleton className="h-48" />
          ) : (logs.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No irrigation logs yet</p>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              <div className="grid grid-cols-5 text-[10px] uppercase tracking-wider text-muted-foreground pb-2 font-medium">
                <span>Zone</span>
                <span>Action</span>
                <span>Trigger</span>
                <span>Duration</span>
                <span>Time</span>
              </div>
              {(logs.data ?? []).slice(0, 30).map((log) => (
                <div key={log.id} className="grid grid-cols-5 py-2 text-xs items-center">
                  <span className="font-medium truncate pr-2">{log.zoneName}</span>
                  <span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4",
                        log.action === "started" ? "text-primary border-primary/40" : "text-muted-foreground"
                      )}
                    >
                      {log.action}
                    </Badge>
                  </span>
                  <span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 h-4 capitalize", triggerConfig[log.trigger])}
                    >
                      {log.trigger}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.durationSeconds ? `${Math.round(log.durationSeconds / 60)}m` : "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
