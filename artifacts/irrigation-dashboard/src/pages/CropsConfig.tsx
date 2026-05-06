import { useState, useMemo } from "react";
import { useGetCrops, useGetSoilTypes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Leaf, Layers, Droplets, Cloud, Activity, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const drainageColor: Record<string, string> = {
  slow: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  medium: "text-primary border-primary/30 bg-primary/10",
  fast: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

const drainageOrder: Record<string, number> = { slow: 0, medium: 1, fast: 2 };

// Heuristic crop category from name/description
function getCropCategory(name: string, desc: string): string {
  const n = name.toLowerCase();
  const d = desc.toLowerCase();
  if (["wheat","rice","maize","barley","sorghum","millet","oats","rye","triticale","quinoa","buckwheat","teff","amaranth","fonio"].some(c => n.includes(c))) return "Cereals & Grains";
  if (["soybean","chickpea","lentil","bean","pea","groundnut","peanut","cowpea","pigeon","fava","lima","adzuki","winged","lupine","mung"].some(c => n.includes(c))) return "Legumes";
  if (["cotton","sunflower","canola","rapeseed","sesame","linseed","flaxseed","safflower","castor","hemp"].some(c => n.includes(c))) return "Industrial Crops";
  if (["banana","plantain","mango","papaya","pineapple","watermelon","cantaloupe","strawberry","avocado","grape","blueberry","raspberry","blackberry","cherry","peach","nectarine","plum","apricot","apple","pear","fig","pomegranate","kiwi","dragon","passion","guava","jackfruit","durian","lychee","mulberry"].some(c => n.includes(c))) return "Fruits";
  if (["coffee","cocoa","cacao","tea","sugarcane","sugar beet","tobacco","vanilla","pepper","ginger","turmeric","cardamom","cinnamon","clove","nutmeg","lemongrass","saffron","moringa","baobab"].some(c => n.includes(c))) return "Cash & Spice Crops";
  if (["rubber","jute","sisal","hemp"].some(c => n.includes(c))) return "Fiber & Industrial";
  if (["olive","date","coconut","oil palm"].some(c => n.includes(c))) return "Tree Crops";
  if (["tomato","potato","onion","garlic","carrot","cabbage","broccoli","cauliflower","spinach","lettuce","cucumber","eggplant","brinjal","pepper","okra","corn","pumpkin","zucchini","sweet potato","cassava","yam","taro","beetroot","radish","turnip","leek","celery","asparagus","artichoke","brussels","bok choy","kale","chard","fennel"].some(c => n.includes(c))) return "Vegetables";
  if (["aloe","stevia"].some(c => n.includes(c))) return "Medicinal & Specialty";
  return "Other";
}

function getSoilCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sand") && !n.includes("loam")) return "Sandy Soils";
  if (n.includes("sandy loam") || n.includes("coarse sandy") || n.includes("fine sandy")) return "Sandy Loams";
  if (n.includes("loam") && !n.includes("sandy") && !n.includes("clay") && !n.includes("silt")) return "Loam Soils";
  if (n.includes("silt")) return "Silty Soils";
  if (n.includes("clay") || n.includes("vertisol")) return "Clay Soils";
  if (n.includes("peat") || n.includes("muck")) return "Organic & Peat";
  if (n.includes("andosol") || n.includes("volcanic") || n.includes("vitric")) return "Volcanic Soils";
  if (n.includes("laterite") || n.includes("oxisol") || n.includes("ultisol") || n.includes("ferralsol")) return "Tropical Soils";
  if (n.includes("saline") || n.includes("sodic") || n.includes("solonchak") || n.includes("solonetz")) return "Saline & Sodic";
  if (n.includes("calcareous") || n.includes("rendzina") || n.includes("leptosol") || n.includes("lithosol")) return "Calcareous & Rocky";
  if (n.includes("alluvial") || n.includes("fluvisol") || n.includes("deltaic") || n.includes("riverine")) return "Alluvial Soils";
  if (n.includes("chernozem") || n.includes("phaeozem") || n.includes("kastanozem")) return "Black Earths";
  if (n.includes("aridisol") || n.includes("regosol") || n.includes("desert") || n.includes("gypsisol") || n.includes("durisol")) return "Arid & Desert";
  if (n.includes("podzol") || n.includes("spodosol")) return "Podzols";
  if (n.includes("gleysol") || n.includes("stagnosol") || n.includes("gley")) return "Hydromorphic";
  if (n.includes("cryo") || n.includes("permafrost")) return "Permafrost";
  if (n.includes("anthrosol") || n.includes("paddy") || n.includes("urban") || n.includes("technosol") || n.includes("plaggen")) return "Anthropogenic";
  if (n.includes("loess")) return "Aeolian Soils";
  return "Other";
}

const ITEMS_PER_PAGE = 24;

export default function CropsConfig() {
  const crops = useGetCrops();
  const soilTypes = useGetSoilTypes();

  const [cropSearch, setCropSearch] = useState("");
  const [cropCategory, setCropCategory] = useState("All");
  const [cropPage, setCropPage] = useState(1);

  const [soilSearch, setSoilSearch] = useState("");
  const [soilCategory, setSoilCategory] = useState("All");
  const [soilDrainage, setSoilDrainage] = useState("All");

  // --- Crops ---
  const cropsWithCategory = useMemo(
    () => (crops.data ?? []).map((c) => ({ ...c, category: getCropCategory(c.name, c.description) })),
    [crops.data]
  );
  const cropCategories = useMemo(
    () => ["All", ...Array.from(new Set(cropsWithCategory.map((c) => c.category))).sort()],
    [cropsWithCategory]
  );
  const filteredCrops = useMemo(() => {
    const q = cropSearch.toLowerCase();
    return cropsWithCategory.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      const matchesCat = cropCategory === "All" || c.category === cropCategory;
      return matchesSearch && matchesCat;
    });
  }, [cropsWithCategory, cropSearch, cropCategory]);

  const totalCropPages = Math.ceil(filteredCrops.length / ITEMS_PER_PAGE);
  const pagedCrops = filteredCrops.slice((cropPage - 1) * ITEMS_PER_PAGE, cropPage * ITEMS_PER_PAGE);

  // Reset page on filter change
  const handleCropSearch = (v: string) => { setCropSearch(v); setCropPage(1); };
  const handleCropCategory = (v: string) => { setCropCategory(v); setCropPage(1); };

  // --- Soil Types ---
  const soilWithCategory = useMemo(
    () => (soilTypes.data ?? []).map((s) => ({ ...s, category: getSoilCategory(s.name) })),
    [soilTypes.data]
  );
  const soilCategories = useMemo(
    () => ["All", ...Array.from(new Set(soilWithCategory.map((s) => s.category))).sort()],
    [soilWithCategory]
  );
  const filteredSoils = useMemo(() => {
    const q = soilSearch.toLowerCase();
    return soilWithCategory.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      const matchesCat = soilCategory === "All" || s.category === soilCategory;
      const matchesDrain = soilDrainage === "All" || s.drainageRate === soilDrainage;
      return matchesSearch && matchesCat && matchesDrain;
    });
  }, [soilWithCategory, soilSearch, soilCategory, soilDrainage]);

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          Crop & Soil Intelligence Database
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {crops.data?.length ?? "—"} crops · {soilTypes.data?.length ?? "—"} soil types — comprehensive agronomic reference
        </p>
      </div>

      <Tabs defaultValue="crops">
        <TabsList className="bg-muted">
          <TabsTrigger value="crops" className="gap-2">
            <Leaf className="w-3.5 h-3.5" />Crops ({crops.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="soils" className="gap-2">
            <Layers className="w-3.5 h-3.5" />Soil Types ({soilTypes.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="matrix">
            Matrix
          </TabsTrigger>
        </TabsList>

        {/* ===== CROPS TAB ===== */}
        <TabsContent value="crops" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search crops..."
                value={cropSearch}
                onChange={(e) => handleCropSearch(e.target.value)}
                className="pl-8 bg-muted border-input text-sm h-9"
              />
            </div>
            <Select value={cropCategory} onValueChange={handleCropCategory}>
              <SelectTrigger className="w-52 bg-muted border-input h-9 text-sm">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-card-border max-h-72 overflow-y-auto">
                {cropCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
              {filteredCrops.length} of {crops.data?.length ?? 0} shown
            </span>
          </div>

          {/* Grid */}
          {crops.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
            </div>
          ) : pagedCrops.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No crops match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {pagedCrops.map((crop) => (
                <Card key={crop.id} className="border-card-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">{crop.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-1 bg-primary/5 text-primary/80 border-primary/20">
                          {crop.category}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                        <Cloud className="w-2.5 h-2.5 mr-1" />
                        {crop.waterRequirementMm}mm
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{crop.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {/* Moisture Range */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Droplets className="w-2.5 h-2.5" />Ideal Moisture
                        </span>
                        <span className="font-medium">{crop.idealMoistureMin}–{crop.idealMoistureMax}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden relative">
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
                    <div className="flex flex-wrap gap-1">
                      {crop.growthStages.slice(0, 4).map((stage: string, i: number) => (
                        <span
                          key={stage}
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full border",
                            i === 0 ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"
                          )}
                        >{stage}</span>
                      ))}
                      {crop.growthStages.length > 4 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                          +{crop.growthStages.length - 4} more
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalCropPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCropPage((p) => Math.max(1, p - 1))}
                disabled={cropPage === 1}
                className="px-3 py-1.5 text-xs rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-muted-foreground">
                Page {cropPage} of {totalCropPages}
              </span>
              <button
                onClick={() => setCropPage((p) => Math.min(totalCropPages, p + 1))}
                disabled={cropPage === totalCropPages}
                className="px-3 py-1.5 text-xs rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </TabsContent>

        {/* ===== SOIL TYPES TAB ===== */}
        <TabsContent value="soils" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search soil types..."
                value={soilSearch}
                onChange={(e) => setSoilSearch(e.target.value)}
                className="pl-8 bg-muted border-input text-sm h-9"
              />
            </div>
            <Select value={soilCategory} onValueChange={setSoilCategory}>
              <SelectTrigger className="w-48 bg-muted border-input h-9 text-sm">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-card-border max-h-72 overflow-y-auto">
                {soilCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={soilDrainage} onValueChange={setSoilDrainage}>
              <SelectTrigger className="w-36 bg-muted border-input h-9 text-sm">
                <SelectValue placeholder="Drainage" />
              </SelectTrigger>
              <SelectContent className="bg-card border-card-border">
                <SelectItem value="All">All drainage</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
              {filteredSoils.length} of {soilTypes.data?.length ?? 0} shown
            </span>
          </div>

          {/* Group by category */}
          {soilTypes.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : filteredSoils.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No soil types match your search</p>
            </div>
          ) : (
            (() => {
              const grouped: Record<string, typeof filteredSoils> = {};
              filteredSoils.forEach((s) => {
                if (!grouped[s.category]) grouped[s.category] = [];
                grouped[s.category].push(s);
              });
              return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, soils]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />{category}
                    <span className="text-[10px] normal-case tracking-normal text-muted-foreground/60">({soils.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {soils.sort((a, b) => drainageOrder[a.drainageRate] - drainageOrder[b.drainageRate]).map((soil) => (
                      <Card key={soil.id} className="border-card-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold leading-tight">{soil.name}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 capitalize flex-shrink-0", drainageColor[soil.drainageRate])}>
                              {soil.drainageRate}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">{soil.description}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Activity className="w-2.5 h-2.5" />Retention
                              </span>
                              <span className="font-medium">{(soil.waterRetentionCapacity * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", soil.drainageRate === "fast" ? "bg-amber-500" : soil.drainageRate === "slow" ? "bg-blue-500" : "bg-primary")}
                                style={{ width: `${soil.waterRetentionCapacity * 100}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ));
            })()
          )}
        </TabsContent>

        {/* ===== MATRIX TAB ===== */}
        <TabsContent value="matrix" className="mt-4">
          <Card className="border-card-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Soil–Crop Compatibility & Irrigation Adjustment Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-0 divide-y divide-border">
                <div className="grid grid-cols-5 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <span>Soil Type</span>
                  <span>Retention</span>
                  <span>Drainage</span>
                  <span>Irrigation Adjustment</span>
                  <span>Best Crops</span>
                </div>
                {(soilTypes.data ?? []).slice(0, 30).map((soil) => (
                  <div key={soil.id} className="grid grid-cols-5 py-2 items-center gap-2">
                    <span className="font-medium truncate">{soil.name}</span>
                    <span className="text-muted-foreground">{(soil.waterRetentionCapacity * 100).toFixed(0)}%</span>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 w-fit capitalize", drainageColor[soil.drainageRate])}>
                      {soil.drainageRate}
                    </Badge>
                    <span className="text-muted-foreground text-[11px]">
                      {soil.drainageRate === "fast"
                        ? "+25% irrigation freq, reduce interval"
                        : soil.drainageRate === "slow"
                        ? "−30% volume, improve drainage"
                        : "Standard schedule, monitor closely"}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {soil.drainageRate === "fast" ? "Carrots, Radish, Garlic, Sandy-adapted" :
                       soil.drainageRate === "slow" ? "Rice, Sugarcane, Taro, Paddy crops" :
                       "Wheat, Maize, Tomato, Soybean"}
                    </span>
                  </div>
                ))}
              </div>
              {(soilTypes.data?.length ?? 0) > 30 && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Showing top 30 of {soilTypes.data?.length} soil types. Use the Soil Types tab to browse all.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
