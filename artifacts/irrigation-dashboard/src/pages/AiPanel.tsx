import { useState } from "react";
import {
  useGetCurrentWeather,
  useGetWeatherForecast,
  useGetWeatherLocation,
  useUpdateWeatherLocation,
  getGetCurrentWeatherQueryKey,
  getGetWeatherLocationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Cloud, CloudRain, Wind, Thermometer, Droplets,
  MapPin, Navigation, CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function WeatherData() {
  const queryClient = useQueryClient();
  const weather = useGetCurrentWeather();
  const forecast = useGetWeatherForecast();
  const location = useGetWeatherLocation();
  const updateLocation = useUpdateWeatherLocation();

  const [relocateOpen, setRelocateOpen] = useState(false);
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newName, setNewName] = useState("");

  const openRelocate = () => {
    setNewLat(location.data?.latitude.toString() ?? "");
    setNewLng(location.data?.longitude.toString() ?? "");
    setNewName(location.data?.name ?? "");
    setRelocateOpen(true);
  };

  const handleRelocate = () => {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (isNaN(lat) || isNaN(lng)) return;

    updateLocation.mutate(
      { data: { latitude: lat, longitude: lng, name: newName || location.data?.name || "Farm Location" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentWeatherQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWeatherLocationQueryKey() });
          setRelocateOpen(false);
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-400" />
            Weather Data
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            {location.isLoading ? (
              <Skeleton className="h-4 w-56" />
            ) : location.data ? (
              <span className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{location.data.name}</span>
                <span className="ml-2 text-xs font-mono text-muted-foreground/70">
                  {location.data.latitude.toFixed(4)}°N, {location.data.longitude.toFixed(4)}°E
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Farm Location</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={openRelocate}>
          <Navigation className="w-3.5 h-3.5" />
          Relocate
        </Button>
      </div>

      {/* Current Conditions */}
      {weather.isLoading ? (
        <Skeleton className="h-44" />
      ) : weather.data ? (
        <Card className="border-sky-500/20 bg-sky-500/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-400" />
              Current Conditions
              <Badge variant="outline" className="text-[10px] ml-auto text-muted-foreground">
                {format(new Date(weather.data.timestamp), "HH:mm 'today'")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
                <Thermometer className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400 tabular-nums">{weather.data.temperature}°C</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Temperature</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
                <Droplets className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400 tabular-nums">{weather.data.humidity}%</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Humidity</div>
              </div>
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4 text-center">
                <Wind className="w-5 h-5 text-sky-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-sky-400 tabular-nums">{weather.data.windSpeed}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Wind (km/h)</div>
              </div>
              <div className={cn(
                "rounded-lg border p-4 text-center",
                weather.data.rainProbability >= 50 ? "bg-blue-600/10 border-blue-600/20" : "bg-muted/40 border-border"
              )}>
                <CloudRain className={cn("w-5 h-5 mx-auto mb-2", weather.data.rainProbability >= 50 ? "text-blue-400" : "text-muted-foreground")} />
                <div className={cn("text-2xl font-bold tabular-nums", weather.data.rainProbability >= 50 ? "text-blue-400" : "text-foreground")}>
                  {weather.data.rainProbability}%
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Rain Probability</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-xs">
              <CloudRain className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span className="text-muted-foreground">Conditions:</span>
              <span className="font-medium">{weather.data.description}</span>
              <Badge className="ml-auto text-[10px]" variant="outline">
                {weather.data.rainProbability >= 90
                  ? "Skip all irrigation"
                  : weather.data.rainProbability >= 50
                  ? "Partial irrigation only"
                  : "Full irrigation OK"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 5-Day Forecast */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-sky-400" />
            5-Day Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {forecast.isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : (forecast.data ?? []).map((day) => (
                  <div key={day.date} className="flex items-center gap-4 py-3 px-4 rounded-lg bg-muted/40 border border-border text-xs">
                    <span className="w-24 font-medium text-foreground">
                      {format(new Date(day.date + "T00:00:00"), "EEE, MMM d")}
                    </span>
                    <span className="text-muted-foreground flex-1 truncate">{day.description}</span>
                    <div className="flex items-center gap-1.5 w-16">
                      <CloudRain className={cn("w-3.5 h-3.5 flex-shrink-0", day.rainProbability >= 50 ? "text-blue-400" : "text-muted-foreground")} />
                      <span className={cn("font-medium", day.rainProbability >= 50 ? "text-blue-400" : "text-muted-foreground")}>
                        {day.rainProbability}%
                      </span>
                    </div>
                    <span className="text-muted-foreground w-24 text-right">
                      {day.lowTemp.toFixed(0)}°–{day.highTemp.toFixed(0)}°C
                    </span>
                    <div className="w-20 flex justify-end">
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

      {/* Rain-based irrigation guide */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Rain-Based Irrigation Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {[
              { range: "≥ 90%", label: "Skip all irrigation", desc: "Heavy rain incoming — no irrigation needed", color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/20" },
              { range: "50–90%", label: "Partial irrigation", desc: "Moderate rain expected — irrigate dry zones only", color: "text-sky-400", bg: "bg-sky-500/8 border-sky-500/20" },
              { range: "< 50%", label: "Full irrigation OK", desc: "Low rain probability — proceed normally", color: "text-primary", bg: "bg-primary/8 border-primary/20" },
            ].map((row) => (
              <div key={row.range} className={cn("flex items-center gap-4 px-4 py-3 rounded-lg border", row.bg)}>
                <Badge variant="outline" className={cn("text-xs font-mono w-16 justify-center flex-shrink-0 border-current", row.color)}>
                  {row.range}
                </Badge>
                <div>
                  <div className={cn("font-semibold", row.color)}>{row.label}</div>
                  <div className="text-muted-foreground">{row.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Relocate Dialog */}
      <Dialog open={relocateOpen} onOpenChange={setRelocateOpen}>
        <DialogContent className="bg-card border-card-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              Update Farm Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Location Name</Label>
              <Input
                placeholder="e.g. North Farm, Field Station A"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-muted border-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Latitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 20.5937"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  className="bg-muted border-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Longitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 78.9629"
                  value={newLng}
                  onChange={(e) => setNewLng(e.target.value)}
                  className="bg-muted border-input"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Enter GPS coordinates for your farm. Weather data context is updated to reflect this location.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRelocateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRelocate}
              disabled={!newLat || !newLng || isNaN(parseFloat(newLat)) || isNaN(parseFloat(newLng)) || updateLocation.isPending}
            >
              {updateLocation.isPending ? "Saving…" : "Save Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
