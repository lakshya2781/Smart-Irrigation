import { useGetAiRecommendations, useGetCurrentWeather, useGetWeatherForecast } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, CloudRain, CheckCircle2, XCircle, Eye, Clock, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const decisionConfig = {
  irrigate_full: { label: "Full Irrigation", color: "bg-primary/15 text-primary border-primary/30", icon: Droplets },
  irrigate_partial: { label: "Partial Irrigation", color: "bg-sky-500/15 text-sky-400 border-sky-500/30", icon: Droplets },
  skip_rain: { label: "Skip — Rain Incoming", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CloudRain },
  skip_wet: { label: "Skip — Soil Wet", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CloudRain },
};

const recConfig = {
  irrigate: { color: "text-primary border-primary/30 bg-primary/10", icon: Droplets },
  skip: { color: "text-muted-foreground border-border bg-card", icon: XCircle },
  monitor: { color: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: Eye },
};

export default function AiPanel() {
  const recs = useGetAiRecommendations();
  const weather = useGetCurrentWeather();
  const forecast = useGetWeatherForecast();

  const data = recs.data;
  const decision = data ? decisionConfig[data.overallDecision] : null;

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          AI Irrigation Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Decision logic based on soil moisture, crop type, soil type, and weather forecast</p>
      </div>

      {/* Overall Decision */}
      {recs.isLoading ? (
        <Skeleton className="h-32" />
      ) : decision && data ? (
        <Card className={cn("border", decision.color.split(" ")[2])}>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0", decision.color.split(" ").slice(0, 2).join(" "))}>
                <decision.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className={cn("text-sm font-semibold px-3 py-1", decision.color)}>
                    {decision.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(data.generatedAt), "HH:mm:ss")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.reasoning}</p>
              </div>
            </div>

            {/* Rain Probability Influence */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Rain Probability Influence</span>
                <span className="font-semibold text-foreground">{data.rainProbabilityFactor.toFixed(0)}%</span>
              </div>
              <Progress
                value={data.rainProbabilityFactor}
                className="h-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Full irrigation (&lt;50%)</span>
                <span>Partial (50–90%)</span>
                <span>Skip (&gt;90%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Per-Zone Recommendations */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Zone-by-Zone Recommendations</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {recs.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : (data?.zones ?? []).map((zone) => {
                const cfg = recConfig[zone.recommendation];
                return (
                  <Card key={zone.zoneId} className={cn("border", cfg.color.split(" ")[2])}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold">{zone.zoneName}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {zone.suggestedDurationMinutes > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {zone.suggestedDurationMinutes} min
                            </span>
                          )}
                          <Badge variant="outline" className={cn("text-xs capitalize", cfg.color)}>
                            <cfg.icon className="w-3 h-3 mr-1" />
                            {zone.recommendation}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{zone.reasoning}</p>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* Weather Forecast */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-sky-400" />
            5-Day Weather Forecast & Irrigation Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {forecast.isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : (forecast.data ?? []).map((day) => (
                  <div key={day.date} className="flex items-center gap-4 py-2.5 px-3 rounded-lg bg-muted/40 border border-border text-xs">
                    <span className="w-20 font-medium text-foreground">{format(new Date(day.date + "T00:00:00"), "EEE, MMM d")}</span>
                    <span className="text-muted-foreground w-24 truncate">{day.description}</span>
                    <div className="flex items-center gap-1 w-24">
                      <CloudRain className={cn("w-3 h-3", day.rainProbability >= 50 ? "text-blue-400" : "text-muted-foreground")} />
                      <span className={day.rainProbability >= 50 ? "text-blue-400 font-medium" : "text-muted-foreground"}>
                        {day.rainProbability}%
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {day.lowTemp.toFixed(0)}° – {day.highTemp.toFixed(0)}°C
                    </div>
                    <div className="ml-auto">
                      {day.irrigationRecommended ? (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />Irrigate
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <XCircle className="w-2.5 h-2.5 mr-1" />Skip
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Logic Explanation */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Decision Logic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {[
              { condition: "Rain probability ≥ 90%", action: "No irrigation — skip all zones", color: "text-blue-400" },
              { condition: "Rain probability 50–90%", action: "Partial irrigation — only critically dry zones", color: "text-sky-400" },
              { condition: "Rain probability < 50%", action: "Full irrigation — run all moisture-deficient zones", color: "text-primary" },
              { condition: "Zone moisture > max threshold", action: "Skip zone — waterlogging risk", color: "text-muted-foreground" },
              { condition: "Zone moisture < min threshold", action: "Irrigate — calculate duration from soil retention", color: "text-amber-400" },
            ].map((row, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-foreground">IF </span>
                  <span className="text-muted-foreground">{row.condition}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className={row.color}>{row.action}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
