import { useState } from "react";
import {
  useGetSensorHistory,
  useGetLatestSensorReadings,
  useGetZones,
  getGetSensorHistoryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Droplets, Thermometer, Gauge, Activity } from "lucide-react";
import { format } from "date-fns";

const ZONE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#a855f7"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Sensors() {
  const [hours, setHours] = useState(24);
  const sensors = useGetLatestSensorReadings();
  const zones = useGetZones();

  // Per-zone history
  const zone1History = useGetSensorHistory({ hours, zoneId: 1 });
  const zone2History = useGetSensorHistory({ hours, zoneId: 2 });
  const zone3History = useGetSensorHistory({ hours, zoneId: 3 });
  const zone4History = useGetSensorHistory({ hours, zoneId: 4 });

  // Global readings (temp/humidity/tank)
  const globalHistory = useGetSensorHistory({ hours });

  // Build chart data for moisture
  const allTimestamps = new Set<string>();
  const zoneHistories = [zone1History.data ?? [], zone2History.data ?? [], zone3History.data ?? [], zone4History.data ?? []];

  zoneHistories.forEach((h) => h.forEach((r) => allTimestamps.add(r.recordedAt)));

  const moistureData = Array.from(allTimestamps)
    .sort()
    .filter((_, i) => i % 2 === 0) // downsample
    .map((ts) => {
      const row: Record<string, string | number> = {
        time: format(new Date(ts), "HH:mm"),
      };
      zoneHistories.forEach((h, idx) => {
        const match = h.find((r) => r.recordedAt === ts);
        if (match?.moisture != null) row[`Zone ${idx + 1}`] = match.moisture;
      });
      return row;
    }).slice(-48);

  // Build chart data for temp/humidity
  const globalData = (globalHistory.data ?? [])
    .filter((r) => r.temperature != null)
    .filter((_, i) => i % 2 === 0)
    .map((r) => ({
      time: format(new Date(r.recordedAt), "HH:mm"),
      Temp: r.temperature,
      Humidity: r.humidity,
    })).slice(0, 48).reverse();

  // Tank level
  const tankData = (globalHistory.data ?? [])
    .filter((r) => r.tankLevelPercent != null)
    .filter((_, i) => i % 2 === 0)
    .map((r) => ({
      time: format(new Date(r.recordedAt), "HH:mm"),
      Tank: r.tankLevelPercent,
    })).slice(0, 48).reverse();

  const zoneNames = (zones.data ?? []).map((z) => z.name);

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Sensor Data Visualization</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Historical trends from all ESP32 sensors</p>
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

      {/* Live readings row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {sensors.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            {(sensors.data?.zones ?? []).map((z, i) => (
              <Card key={z.zoneId} className="border-card-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground truncate">{z.zoneName}</span>
                    <Droplets className="w-3.5 h-3.5" style={{ color: ZONE_COLORS[i] }} />
                  </div>
                  <div className="text-xl font-bold tabular-nums">{z.moisture.toFixed(1)}<span className="text-xs text-muted-foreground">%</span></div>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 mt-1">{z.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Moisture Trend Chart */}
      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Droplets className="w-4 h-4 text-primary" />
            Soil Moisture Trends (last {hours}h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moistureData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }} />
                <ReferenceLine y={40} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                {[1, 2, 3, 4].map((n, i) => (
                  <Line
                    key={n}
                    type="monotone"
                    dataKey={`Zone ${n}`}
                    stroke={ZONE_COLORS[i]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Temp & Humidity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-amber-400" />
              Temperature & Humidity (DHT22)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Current temp: </span>
                <span className="font-semibold">{sensors.data?.temperature?.toFixed(1)}°C</span>
              </div>
              <div>
                <span className="text-muted-foreground">Humidity: </span>
                <span className="font-semibold">{sensors.data?.humidity?.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={globalData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line type="monotone" dataKey="Temp" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Humidity" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tank Level */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-400" />
              Tank Water Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{sensors.data?.tankLevelPercent?.toFixed(0) ?? "—"}</span>
              <span className="text-muted-foreground text-sm">%</span>
              {(sensors.data?.tankLevelPercent ?? 100) < 20 && (
                <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
              )}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tankData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Critical", fill: "#ef4444", fontSize: 10 }} />
                  <Line type="monotone" dataKey="Tank" stroke="#3b82f6" strokeWidth={1.5} dot={false} fill="rgba(59,130,246,0.1)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Water logging */}
      <Card className="border-card-border">
        <CardContent className="p-4 flex items-center gap-3">
          <Activity className={`w-5 h-5 ${sensors.data?.waterLoggingDetected ? "text-red-400" : "text-primary"}`} />
          <div>
            <div className="text-sm font-semibold">Water Logging Sensor</div>
            <div className="text-xs text-muted-foreground">Field waterlogging detection</div>
          </div>
          <Badge
            className="ml-auto"
            variant={sensors.data?.waterLoggingDetected ? "destructive" : "outline"}
          >
            {sensors.data?.waterLoggingDetected ? "WATERLOGGING DETECTED" : "Clear"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
