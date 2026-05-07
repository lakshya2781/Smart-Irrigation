import { useState } from "react";
import { useGetCropHealth, useGetCropHealthHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Leaf, Droplets, Activity, TrendingUp, AlertTriangle, CheckCircle2, Shield,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

const statusConfig = {
  good:     { label: "Good",     color: "text-primary",  badgeClass: "text-primary border-primary/40 bg-primary/10",  icon: CheckCircle2 },
  moderate: { label: "Moderate", color: "text-amber-400", badgeClass: "text-amber-400 border-amber-400/40 bg-amber-400/10", icon: AlertTriangle },
  critical: { label: "Critical", color: "text-red-400",  badgeClass: "text-red-400 border-red-400/40 bg-red-400/10",  icon: AlertTriangle },
};

const ZONE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#a855f7"];

function HealthIndicator({
  label, value, unit = "%", icon: Icon, color, max = 100,
  description, invertRisk = false,
}: {
  label: string; value: number; unit?: string; icon: React.ComponentType<{ className?: string }>;
  color: string; max?: number; description?: string; invertRisk?: boolean;
}) {
  const displayValue = Math.min(100, Math.max(0, value));
  const barColor = invertRisk
    ? (value > 60 ? "bg-red-500" : value > 30 ? "bg-amber-500" : "bg-primary")
    : (value > 70 ? "bg-primary" : value > 40 ? "bg-amber-500" : "bg-red-500");

  return (
    <Card className="border-card-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", `${color}/15`)}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold">{label}</div>
            {description && <div className="text-[10px] text-muted-foreground leading-tight">{description}</div>}
          </div>
          <div className="text-right">
            <span className="text-xl font-bold tabular-nums">{value.toFixed(invertRisk ? 0 : 2)}</span>
            <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barColor)}
            style={{ width: `${displayValue}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{invertRisk ? "Low risk" : "Poor"}</span>
          <span>{invertRisk ? "High risk" : "Excellent"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">{p.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function CropHealth() {
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const cropHealth = useGetCropHealth();
  const history = useGetCropHealthHistory({ days: 30, zoneId: selectedZone ?? undefined });

  const zones = cropHealth.data ?? [];
  const selectedZoneData = selectedZone !== null
    ? zones.find((z) => z.zoneId === selectedZone)
    : zones[0];

  const radarData = selectedZoneData
    ? [
        { subject: "NDVI",       value: selectedZoneData.ndvi * 100,         fullMark: 100 },
        { subject: "Soil Health",value: selectedZoneData.soilHealthIndex,     fullMark: 100 },
        { subject: "Growth Rate",value: selectedZoneData.growthRate,          fullMark: 100 },
        { subject: "Moisture",   value: Math.max(0, 100 - selectedZoneData.waterStressLevel), fullMark: 100 },
        { subject: "No Disease", value: Math.max(0, 100 - selectedZoneData.riskDisease),      fullMark: 100 },
        { subject: "No Drought", value: Math.max(0, 100 - selectedZoneData.riskDrought),      fullMark: 100 },
      ]
    : [];

  const trendData = (() => {
    const byDate: Record<string, { ndvi: number; soil: number; growth: number; count: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      byDate[d] = { ndvi: 0, soil: 0, growth: 0, count: 0 };
    }
    (history.data ?? []).forEach((r) => {
      const d = format(new Date(r.recordedAt), "MMM d");
      if (byDate[d]) {
        byDate[d].ndvi += r.ndvi;
        byDate[d].soil += r.soilHealthIndex;
        byDate[d].growth += r.growthRate;
        byDate[d].count++;
      }
    });

    return Object.entries(byDate)
      .filter((_, i, arr) => i % 3 === 0 || i === arr.length - 1)
      .map(([date, v]) => ({
        date,
        NDVI:         v.count > 0 ? +(v.ndvi / v.count).toFixed(3) : null,
        "Soil Health":v.count > 0 ? +(v.soil / v.count).toFixed(1) : null,
        "Growth Rate":v.count > 0 ? +(v.growth / v.count).toFixed(1) : null,
      }));
  })();

  const overallStatus = zones.length > 0
    ? zones.reduce((worst, z) => {
        if (worst === "critical" || z.overallStatus === "critical") return "critical";
        if (worst === "moderate" || z.overallStatus === "moderate") return "moderate";
        return "good";
      }, "good" as "good" | "moderate" | "critical")
    : "good";

  const statusConf = statusConfig[overallStatus];
  const StatusIcon = statusConf.icon;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            Crop Health
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            NDVI analysis, soil health monitoring, and predictive insights
          </p>
        </div>
        <Badge variant="outline" className={cn("text-sm px-3 py-1 gap-1.5", statusConf.badgeClass)}>
          <StatusIcon className="w-3.5 h-3.5" />
          Overall: {statusConf.label}
        </Badge>
      </div>

      {/* Zone selector */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground self-center">View zone:</span>
        {zones.map((z, i) => (
          <Button
            key={z.zoneId ?? i}
            variant={selectedZone === (z.zoneId ?? null) || (selectedZone === null && i === 0) ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setSelectedZone(z.zoneId ?? null)}
          >
            {z.zoneName}
          </Button>
        ))}
      </div>

      {/* 4 Health Indicators */}
      {cropHealth.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : selectedZoneData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthIndicator
            label="NDVI"
            value={Math.round(selectedZoneData.ndvi * 1000) / 10}
            unit=""
            icon={Leaf}
            color="text-primary"
            description="Vegetation index (0–1)"
          />
          <HealthIndicator
            label="Soil Health Index"
            value={selectedZoneData.soilHealthIndex}
            icon={Activity}
            color="text-amber-400"
            description="Composite soil quality score"
          />
          <HealthIndicator
            label="Water Stress"
            value={selectedZoneData.waterStressLevel}
            icon={Droplets}
            color="text-blue-400"
            description="Higher = more stressed"
            invertRisk
          />
          <HealthIndicator
            label="Growth Rate"
            value={selectedZoneData.growthRate}
            icon={TrendingUp}
            color="text-teal-400"
            description="Relative to optimal growth"
          />
        </div>
      ) : null}

      {/* Charts row: Radar + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Zone Health Radar
              {selectedZoneData && (
                <span className="text-muted-foreground font-normal ml-1">— {selectedZoneData.zoneName}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cropHealth.isLoading ? (
              <Skeleton className="h-56" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} />
                    <Radar
                      name={selectedZoneData?.zoneName ?? "Zone"}
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              30-Day Health Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.isLoading ? (
              <Skeleton className="h-56" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Line type="monotone" dataKey="Soil Health"  stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="Growth Rate"  stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Predictive Insights + Risk Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prediction */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Leaf className="w-4 h-4 text-primary" />
              Predictive Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cropHealth.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              zones.map((z, i) => {
                const conf = statusConfig[z.overallStatus];
                const ZIcon = conf.icon;
                return (
                  <div key={z.zoneId ?? i} className={cn("rounded-lg border p-3", conf.badgeClass.includes("primary") ? "border-primary/20 bg-primary/5" : conf.badgeClass.includes("amber") ? "border-amber-500/20 bg-amber-500/5" : "border-red-500/20 bg-red-500/5")}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <ZIcon className={cn("w-3.5 h-3.5", conf.color)} />
                      <span className="text-xs font-semibold">{z.zoneName}</span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 ml-auto", conf.badgeClass)}>
                        {conf.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{z.predictionText}</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Risk Analysis */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Risk Analysis
              {selectedZoneData && (
                <span className="text-muted-foreground font-normal text-xs ml-1">— {selectedZoneData.zoneName}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cropHealth.isLoading ? (
              <Skeleton className="h-32" />
            ) : selectedZoneData ? (
              <>
                {[
                  { label: "Drought Risk", value: selectedZoneData.riskDrought, color: "bg-amber-500", textColor: "text-amber-400" },
                  { label: "Overwatering Risk", value: selectedZoneData.riskOverwatering, color: "bg-blue-500", textColor: "text-blue-400" },
                  { label: "Disease Risk", value: selectedZoneData.riskDisease, color: "bg-red-500", textColor: "text-red-400" },
                ].map((risk) => (
                  <div key={risk.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{risk.label}</span>
                      <span className={cn("font-bold tabular-nums", risk.textColor)}>
                        {risk.value.toFixed(0)}%
                        {risk.value > 60 ? " ⚠" : ""}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", risk.color)}
                        style={{ width: `${Math.min(100, risk.value)}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-border">
                  <h4 className="text-xs font-semibold mb-2">Recommended Actions</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {selectedZoneData.riskDrought > 50 && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                        <span>Increase irrigation frequency to reduce drought stress.</span>
                      </div>
                    )}
                    {selectedZoneData.riskOverwatering > 50 && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <span>Reduce irrigation volume — overwatering risk detected.</span>
                      </div>
                    )}
                    {selectedZoneData.riskDisease > 50 && (
                      <div className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                        <span>Inspect crops for fungal or pest indicators. Improve drainage.</span>
                      </div>
                    )}
                    {selectedZoneData.riskDrought <= 50 && selectedZoneData.riskOverwatering <= 50 && selectedZoneData.riskDisease <= 50 && (
                      <div className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-primary">All risk indicators are low. Continue current management schedule.</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
