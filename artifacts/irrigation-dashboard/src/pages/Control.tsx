import { useGetPumps, useControlPump, getGetPumpsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sliders, Zap, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Control() {
  const queryClient = useQueryClient();
  const pumps = useGetPumps();
  const controlPump = useControlPump();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleControl = (pumpId: number, action: "on" | "off" | "auto", isOverride = false) => {
    setPendingId(pumpId);
    controlPump.mutate(
      { id: pumpId, data: { action, isOverride } },
      {
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: getGetPumpsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setPendingId(null);
        },
      }
    );
  };

  const handleAllOff = () => {
    (pumps.data ?? []).forEach((p) => {
      if (p.status !== "off") {
        handleControl(p.id, "off");
      }
    });
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Irrigation Control Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manual pump control and override management</p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleAllOff} className="gap-2">
          <Zap className="w-3.5 h-3.5" />
          All Pumps Off
        </Button>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-semibold text-amber-300">Manual mode active:</span>
          <span className="text-muted-foreground ml-1">Manual overrides disable AI auto-control for the selected pump. Set pump to Auto to re-enable AI control.</span>
        </div>
      </div>

      {/* Pump Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pumps.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)
          : (pumps.data ?? []).map((pump) => {
              const isPending = pendingId === pump.id;
              const isActive = pump.status === "on" || pump.status === "override";

              return (
                <Card
                  key={pump.id}
                  className={cn(
                    "border-card-border transition-colors",
                    isActive ? "border-primary/30 bg-primary/3" : ""
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full flex-shrink-0 transition-colors",
                            pump.status === "on" ? "bg-primary animate-pulse-green" :
                            pump.status === "override" ? "bg-amber-400 animate-pulse" :
                            "bg-muted-foreground"
                          )}
                        />
                        <div>
                          <CardTitle className="text-sm font-semibold">{pump.name}</CardTitle>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{pump.zoneName} · {pump.driverChannel}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          pump.status === "on" ? "text-primary border-primary/40" :
                          pump.status === "override" ? "text-amber-400 border-amber-400/40" :
                          "text-muted-foreground"
                        )}
                      >
                        {pump.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Runtime stat */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Runtime today: <span className="text-foreground font-medium">{pump.runtimeToday.toFixed(0)} min</span></span>
                    </div>

                    {/* Main Toggle */}
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 border border-border">
                      <Label className="text-xs font-medium cursor-pointer">Pump Power</Label>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => handleControl(pump.id, checked ? "on" : "off")}
                        disabled={isPending}
                      />
                    </div>

                    {/* Override Toggle */}
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 border border-border">
                      <div>
                        <Label className="text-xs font-medium cursor-pointer">Manual Override</Label>
                        <p className="text-[10px] text-muted-foreground">Disables AI auto-control</p>
                      </div>
                      <Switch
                        checked={pump.isManualOverride}
                        onCheckedChange={(checked) =>
                          handleControl(pump.id, checked ? "on" : "auto", checked)
                        }
                        disabled={isPending}
                      />
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={pump.status === "on" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handleControl(pump.id, "on")}
                        disabled={isPending}
                      >
                        {isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "On"}
                      </Button>
                      <Button
                        variant={pump.status === "off" ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handleControl(pump.id, "off")}
                        disabled={isPending}
                      >
                        Off
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handleControl(pump.id, "auto", false)}
                        disabled={isPending}
                      >
                        Auto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* System Overview Table */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            System Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 divide-y divide-border">
            {(pumps.data ?? []).map((pump) => (
              <div key={pump.id} className="flex items-center justify-between py-2.5 text-xs">
                <span className="text-muted-foreground">{pump.name}</span>
                <span>{pump.zoneName}</span>
                <span className="text-muted-foreground">{pump.driverChannel}</span>
                <span>{pump.runtimeToday.toFixed(0)} min today</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4",
                    pump.status === "on" ? "text-primary border-primary/40" :
                    pump.status === "override" ? "text-amber-400 border-amber-400/40" : "text-muted-foreground"
                  )}
                >
                  {pump.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
