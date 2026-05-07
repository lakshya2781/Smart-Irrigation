import { useState } from "react";
import {
  useGetSensorHistory,
  useGetLatestSensorReadings,
  useGetZones,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, ReferenceArea,
} from "recharts";
import {
  Droplets, Thermometer, Gauge, Activity, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ZONE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#a855f7"];

const CustomTooltip = ({
  active, payload, label, unit = "",
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  unit?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold tabular-nums">
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
};

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <Minus className="w-3 h-3 text-muted-foreground" />;
  const delta = values[values.length - 1] - values[0];
  if (delta > 1) return <TrendingUp className="w-3 h-3 text-primary" />;
  if (delta < -1) return <TrendingDown className="w-3 h-3 text-amber-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
      title={expanded ? "Collapse chart" : "Expand chart"}
    >
      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );
}

export default function Sensors() {
  const [hours, setHours] = useState(24);
  const [expandMoisture, setExpandMoisture] = useState(true);
  const [expandTempHumid, setExpandTempHumid] = useState(true);
  const [expandTank, setExpandTank] = useState(true);
  const [expandWaterlog, setExpandWaterlog] = useState(true);

  const sensors = useGetLatestSensorReadings();
  const zones = useGetZones();

  const zone1History = useGetSensorHistory({ hours, zoneId: 1 });
  const zone2History = useGetSensorHistory({ hours, zoneId: 2 });
  const zone3History = useGetSensorHistory({ hours, zoneId: 3 });
  const zone4History = useGetSensorHistory({ hours, zoneId: 4 });
  const globalHistory = useGetSensorHistory({ hours });

  const zoneHistories = [
    zone1History.data ?? [],
    zone2History.data ?? [],
    zone3History.data ?? [],
    zone4History.data ?? [],
  ];

  const allTimestamps = new Set<string>();
  zoneHistories.forEach((h) => h.forEach((r) => allTimestamps.add(r.recordedAt)));

  const moistureData = Array.from(allTimestamps)
    .sort()
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0)
    .map((ts) => {
      const row: Record<string, string | number> = { time: format(new Date(ts), "HH:mm") };
      zoneHistories.forEach((h, idx) => {
        const match = h.find((r) => r.recordedAt === ts);
        if (match?.moisture != null) row[`Zone ${idx + 1}`] = match.moisture;
      });
      return row;
    })
    .slice(-60);

  const globalFiltered = (globalHistory.data ?? [])
    .filter((r) => r.temperature != null)
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0)
    .slice(0, 60)
    .reverse();

  const globalData = globalFiltered.map((r) => ({
    time: format(new Date(r.recordedAt), "HH:mm"),
    Temp: r.temperature,
    Humidity: r.humidity,
  }));

  const tankData = (globalHistory.data ?? [])
    .filter((r) => r.tankLevelPercent != null)
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0)
    .slice(0, 60)
    .reverse()
    .map((r) => ({ time: format(new Date(r.recordedAt), "HH:mm"), Tank: r.tankLevelPercent }));

  // Waterlogging history (derive from global history)
  const waterlogData = (globalHistory.data ?? [])
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0)
    .slice(0, 60)
    .reverse()
    .map((r) => ({
      time: format(new Date(r.recordedAt), "HH:mm"),
      Waterlog: r.waterLoggingDetected ? 1 : 0,
    }));

  const zoneTrends = zoneHistories.map((h) =>
    h
      .filter((r) => r.moisture != null)
      .slice(0, 5)
      .reverse()
      .map((r) => r.moisture as number)
  );

  const isLoading = zone1History.isLoading || sensors.isLoading;
  const waterlogging = sensors.data?.waterLoggingDetected ?? false;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Sensor Data Visualization</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live trends from all ESP32 sensors — simulator active</p>
        </div>
        <div className="flex gap-2">
          {[6, 12, 24, 48].map((h) => (
            <Button
              key={h}
              variant={hours === h ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setHours(h)}
            >
              {h}h
            </Button>
          ))}
        </div>
      </div>

      {/* Live zone cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : (sensors.data?.zones ?? []).map((z, i) => (
              <Card key={z.zoneId} className="border-card-border overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground truncate flex-1 mr-2">{z.zoneName}</span>
                    <div className="flex items-center gap-1">
                      <Trend values={zoneTrends[i] ?? []} />
                      <Droplets className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ZONE_COLORS[i] }} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    {z.moisture.toFixed(1)}
                    <span className="text-sm text-muted-foreground ml-0.5">%</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 mt-1.5",
                      z.status === "optimal" ? "text-primary border-primary/30 bg-primary/10"
                        : z.status === "dry"  ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
                        : "text-blue-400 border-blue-400/30 bg-blue-400/10"
                    )}
                  >
                    {z.status}
                  </Badge>
                  <div className="h-10 mt-2 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={zoneTrends[i]?.map((v, idx) => ({ v, idx })) ?? []} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                        <defs>
                          <linearGradient id={`spark${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={ZONE_COLORS[i]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={ZONE_COLORS[i]} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={ZONE_COLORS[i]} strokeWidth={1.5} fill={`url(#spark${i})`} dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Soil Moisture Trend Chart */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Droplets className="w-4 h-4 text-primary" />
              Soil Moisture Trends — All Zones (last {hours}h)
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Optimal: 40–70%</span>
              <ExpandToggle expanded={expandMoisture} onToggle={() => setExpandMoisture((v) => !v)} />
            </div>
          </div>
        </CardHeader>
        {expandMoisture && (
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="h-64 transition-all duration-300">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moistureData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      {[1, 2, 3, 4].map((n, i) => (
                        <linearGradient key={n} id={`moistGrad${n}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={ZONE_COLORS[i]} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={ZONE_COLORS[i]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                    <Tooltip content={<CustomTooltip unit="%" />} />
                    <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }} />
                    <ReferenceArea y1={40} y2={70} fill="hsl(var(--primary))" fillOpacity={0.04} />
                    <ReferenceLine y={40} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <ReferenceLine y={70} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    {[1, 2, 3, 4].map((n, i) => (
                      <Area key={n} type="monotone" dataKey={`Zone ${n}`} stroke={ZONE_COLORS[i]} strokeWidth={2} fill={`url(#moistGrad${n})`} dot={false} connectNulls activeDot={{ r: 4, strokeWidth: 0 }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Temperature & Humidity + Tank */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Temp & Humidity */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-amber-400" />
                Temperature & Humidity — DHT22 (last {hours}h)
              </CardTitle>
              <ExpandToggle expanded={expandTempHumid} onToggle={() => setExpandTempHumid((v) => !v)} />
            </div>
          </CardHeader>
          {expandTempHumid && (
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Temperature</div>
                  <div className="text-xl font-bold text-amber-400 tabular-nums">
                    {sensors.data?.temperature?.toFixed(1) ?? "—"}<span className="text-sm ml-0.5">°C</span>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Humidity</div>
                  <div className="text-xl font-bold text-blue-400 tabular-nums">
                    {sensors.data?.humidity?.toFixed(0) ?? "—"}<span className="text-sm ml-0.5">%</span>
                  </div>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={globalData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="humidGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Area type="monotone" dataKey="Temp"     stroke="#f59e0b" strokeWidth={2} fill="url(#tempGrad)"  dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="Humidity" stroke="#3b82f6" strokeWidth={2} fill="url(#humidGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Tank Level */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Gauge className="w-4 h-4 text-blue-400" />
                Tank Water Level (last {hours}h)
              </CardTitle>
              <ExpandToggle expanded={expandTank} onToggle={() => setExpandTank((v) => !v)} />
            </div>
          </CardHeader>
          {expandTank && (
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "rounded-lg border p-3 flex-1",
                  (sensors.data?.tankLevelPercent ?? 100) < 20 ? "bg-red-500/10 border-red-500/20" : "bg-blue-500/10 border-blue-500/20"
                )}>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Current Level</div>
                  <div className={cn("text-xl font-bold tabular-nums", (sensors.data?.tankLevelPercent ?? 100) < 20 ? "text-red-400" : "text-blue-400")}>
                    {sensors.data?.tankLevelPercent?.toFixed(0) ?? "—"}<span className="text-sm ml-0.5">%</span>
                  </div>
                </div>
                {(sensors.data?.tankLevelPercent ?? 100) < 20 && (
                  <Badge variant="destructive" className="text-xs py-1">CRITICAL — Refill Now</Badge>
                )}
              </div>
              {isLoading ? (
                <Skeleton className="h-52" />
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tankData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tankGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                      <Tooltip content={<CustomTooltip unit="%" />} />
                      <ReferenceArea y1={0} y2={20} fill="#ef4444" fillOpacity={0.06} />
                      <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Critical 20%", fill: "#ef4444", fontSize: 9, position: "insideTopRight" }} />
                      <Area type="monotone" dataKey="Tank" stroke="#3b82f6" strokeWidth={2} fill="url(#tankGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Water Logging Sensor Chart */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className={cn("w-4 h-4", waterlogging ? "text-red-400" : "text-primary")} />
              Water Logging Sensor (last {hours}h)
              <Badge
                variant={waterlogging ? "destructive" : "outline"}
                className="text-[10px]"
              >
                {waterlogging ? "WATERLOGGING DETECTED" : "Clear"}
              </Badge>
            </CardTitle>
            <ExpandToggle expanded={expandWaterlog} onToggle={() => setExpandWaterlog((v) => !v)} />
          </div>
        </CardHeader>
        {expandWaterlog && (
          <CardContent>
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", waterlogging ? "bg-red-400 animate-pulse" : "bg-primary")} />
              <span>Field waterlogging detection via ESP32 digital input.</span>
              <span className="ml-auto font-medium" style={{ color: waterlogging ? "#f87171" : "hsl(var(--primary))" }}>
                Current: {waterlogging ? "DETECTED" : "Clear — no waterlogging"}
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={waterlogData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="waterlogGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? "YES" : "NO")} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [v === 1 ? "Detected" : "Clear", "Waterlogging"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    />
                    <Area type="step" dataKey="Waterlog" stroke="#ef4444" strokeWidth={2} fill="url(#waterlogGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
