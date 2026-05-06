import { useState } from "react";
import {
  useGetZones,
  useGetCrops,
  useGetSoilTypes,
  useUpdateZone,
  getGetZonesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Leaf, Droplets, Settings, Calendar, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

function statusColor(status: string) {
  return status === "optimal" ? "text-primary border-primary/30 bg-primary/10" :
    status === "dry" ? "text-amber-400 border-amber-400/30 bg-amber-400/10" :
    status === "waterlogged" ? "text-blue-400 border-blue-400/30 bg-blue-400/10" :
    "text-red-400 border-red-400/30 bg-red-400/10";
}

function moistureColor(value: number, min: number, max: number) {
  if (value < min - 5) return "bg-amber-500";
  if (value > max + 5) return "bg-blue-500";
  return "bg-primary";
}

export default function Zones() {
  const queryClient = useQueryClient();
  const zones = useGetZones();
  const crops = useGetCrops();
  const soilTypes = useGetSoilTypes();
  const updateZone = useUpdateZone();

  const [editing, setEditing] = useState<{
    id: number; name: string; cropId: number; soilTypeId: number;
    targetMoistureMin: number; targetMoistureMax: number;
  } | null>(null);

  const openEdit = (zone: NonNullable<typeof zones.data>[0]) => {
    setEditing({
      id: zone.id,
      name: zone.name,
      cropId: zone.cropId,
      soilTypeId: zone.soilTypeId,
      targetMoistureMin: zone.targetMoistureMin,
      targetMoistureMax: zone.targetMoistureMax,
    });
  };

  const handleSave = () => {
    if (!editing) return;
    updateZone.mutate(
      {
        id: editing.id,
        data: {
          name: editing.name,
          cropId: editing.cropId,
          soilTypeId: editing.soilTypeId,
          targetMoistureMin: editing.targetMoistureMin,
          targetMoistureMax: editing.targetMoistureMax,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetZonesQueryKey() });
          setEditing(null);
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold">Irrigation Zones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">4 zones monitored by soil moisture sensors</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {zones.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)
          : (zones.data ?? []).map((zone) => (
              <Card key={zone.id} className="border-card-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{zone.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          <Leaf className="w-2.5 h-2.5 mr-1" />{zone.cropName}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          <Layers className="w-2.5 h-2.5 mr-1" />{zone.soilTypeName}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", statusColor(zone.status))}>
                        {zone.status}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(zone)}>
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Moisture gauge */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> Soil Moisture
                      </span>
                      <span className="text-2xl font-bold tabular-nums">{zone.currentMoisture.toFixed(1)}<span className="text-sm text-muted-foreground font-normal">%</span></span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", moistureColor(zone.currentMoisture, zone.targetMoistureMin, zone.targetMoistureMax))}
                        style={{ width: `${Math.min(100, zone.currentMoisture)}%` }}
                      />
                      <div className="absolute top-0 h-full w-0.5 bg-white/20" style={{ left: `${zone.targetMoistureMin}%` }} />
                      <div className="absolute top-0 h-full w-0.5 bg-white/20" style={{ left: `${zone.targetMoistureMax}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0%</span>
                      <span className="text-primary/70">Target: {zone.targetMoistureMin}–{zone.targetMoistureMax}%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Pump info */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border border-border">
                    <span className="text-xs text-muted-foreground">Pump {zone.pumpId}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        zone.pumpStatus === "on" ? "bg-primary animate-pulse-green" :
                        zone.pumpStatus === "override" ? "bg-amber-400" : "bg-muted-foreground"
                      )} />
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0 h-4",
                        zone.pumpStatus === "on" ? "text-primary border-primary/40" :
                        zone.pumpStatus === "override" ? "text-amber-400 border-amber-400/40" : ""
                      )}>
                        {zone.pumpStatus.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Last irrigated */}
                  {zone.lastIrrigated && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Last irrigated: {new Date(zone.lastIrrigated).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-card-border">
          <DialogHeader>
            <DialogTitle>Configure Zone</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Zone Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-muted border-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Crop Type</Label>
                <Select
                  value={String(editing.cropId)}
                  onValueChange={(v) => setEditing({ ...editing, cropId: Number(v) })}
                >
                  <SelectTrigger className="bg-muted border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-card-border">
                    {(crops.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Soil Type</Label>
                <Select
                  value={String(editing.soilTypeId)}
                  onValueChange={(v) => setEditing({ ...editing, soilTypeId: Number(v) })}
                >
                  <SelectTrigger className="bg-muted border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-card-border">
                    {(soilTypes.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Moisture (%)</Label>
                  <Input
                    type="number"
                    value={editing.targetMoistureMin}
                    onChange={(e) => setEditing({ ...editing, targetMoistureMin: Number(e.target.value) })}
                    className="bg-muted border-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Moisture (%)</Label>
                  <Input
                    type="number"
                    value={editing.targetMoistureMax}
                    onChange={(e) => setEditing({ ...editing, targetMoistureMax: Number(e.target.value) })}
                    className="bg-muted border-input"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateZone.isPending}>
              {updateZone.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
