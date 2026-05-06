import { useGetCrops, useGetSoilTypes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Leaf, Layers, Droplets, Cloud, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const drainageColor = {
  slow: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  medium: "text-primary border-primary/30 bg-primary/10",
  fast: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

export default function CropsConfig() {
  const crops = useGetCrops();
  const soilTypes = useGetSoilTypes();

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          Crop & Soil Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Reference database for crop water requirements and soil characteristics</p>
      </div>

      {/* Crops Section */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-primary" />
          Crop Database
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {crops.isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)
            : (crops.data ?? []).map((crop) => (
                <Card key={crop.id} className="border-card-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{crop.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        <Cloud className="w-2.5 h-2.5 mr-1" />
                        {crop.waterRequirementMm} mm/season
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{crop.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Moisture Range */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Droplets className="w-3 h-3" />Ideal Moisture Range
                        </span>
                        <span className="font-medium">{crop.idealMoistureMin}% – {crop.idealMoistureMax}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-primary/30 rounded-full"
                          style={{ width: "100%" }}
                        />
                        <div
                          className="absolute top-0 h-full bg-primary rounded-full"
                          style={{
                            left: `${crop.idealMoistureMin}%`,
                            width: `${crop.idealMoistureMax - crop.idealMoistureMin}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Growth Stages */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Growth Stages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {crop.growthStages.map((stage, i) => (
                          <div
                            key={stage}
                            className={cn(
                              "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border",
                              i === 0
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{
                              background: i === 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                              color: "white",
                            }}>{i + 1}</span>
                            {stage}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>

      {/* Soil Types Section */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          Soil Type Reference
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {soilTypes.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)
            : (soilTypes.data ?? []).map((soil) => (
                <Card key={soil.id} className="border-card-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{soil.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0 h-4 capitalize", drainageColor[soil.drainageRate])}
                      >
                        {soil.drainageRate} drainage
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{soil.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Activity className="w-3 h-3" />Water Retention
                        </span>
                        <span className="font-medium">{(soil.waterRetentionCapacity * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={soil.waterRetentionCapacity * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>

      {/* Quick Reference Table */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Irrigation Adjustment Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs space-y-0 divide-y divide-border">
            <div className="grid grid-cols-4 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Soil Type</span>
              <span>Retention</span>
              <span>Drainage</span>
              <span>Irrigation Adjustment</span>
            </div>
            {(soilTypes.data ?? []).map((soil) => (
              <div key={soil.id} className="grid grid-cols-4 py-2 items-center">
                <span className="font-medium">{soil.name}</span>
                <span className="text-muted-foreground">{(soil.waterRetentionCapacity * 100).toFixed(0)}%</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 w-fit capitalize", drainageColor[soil.drainageRate])}>
                  {soil.drainageRate}
                </Badge>
                <span className="text-muted-foreground">
                  {soil.drainageRate === "fast" ? "+25% frequency" :
                   soil.drainageRate === "slow" ? "-30% volume" : "Standard schedule"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
