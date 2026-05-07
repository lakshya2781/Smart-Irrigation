import { useState, useMemo } from "react";
import { useGetCrops, useGetSoilTypes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Leaf, Layers, Droplets, Cloud, Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const drainageColor: Record<string, string> = {
  slow:   "text-blue-400 border-blue-400/30 bg-blue-400/10",
  medium: "text-primary border-primary/30 bg-primary/10",
  fast:   "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

function getCropCategory(name: string, desc: string): string {
  const n = name.toLowerCase();
  const d = desc.toLowerCase();
  if (["wheat","rice","maize","barley","sorghum","millet","oats","rye","triticale","quinoa","buckwheat","teff","amaranth","fonio"].some(c => n.includes(c))) return "Cereals & Grains";
  if (["soybean","chickpea","lentil","bean","pea","groundnut","peanut","cowpea","pigeon","fava","lima","adzuki","winged","lupine","mung"].some(c => n.includes(c))) return "Legumes";
  if (["cotton","sunflower","canola","rapeseed","sesame","linseed","flaxseed","safflower","castor","hemp"].some(c => n.includes(c))) return "Industrial Crops";
  if (["banana","plantain","mango","papaya","pineapple","watermelon","cantaloupe","strawberry","avocado","grape","blueberry","raspberry","blackberry","cherry","peach","nectarine","plum","apricot","apple","pear","fig","pomegranate","kiwi","dragon","passion","guava","jackfruit","durian","lychee","mulberry"].some(c => n.includes(c))) return "Fruits";
  if (["coffee","cocoa","cacao","tea","sugarcane","sugar beet","tobacco","vanilla","pepper","ginger","turmeric","cardamom","cinnamon","clove","nutmeg","lemongrass","saffron","moringa","baobab"].some(c => n.includes(c))) return "Cash & Spice Crops";
  if (["olive","date","coconut","oil palm"].some(c => n.includes(c))) return "Tree Crops";
  if (["tomato","potato","onion","garlic","carrot","cabbage","broccoli","cauliflower","spinach","lettuce","cucumber","eggplant","brinjal","okra","corn","pumpkin","zucchini","sweet potato","cassava","yam","taro","beetroot","radish","turnip","leek","celery","asparagus","artichoke","brussels","bok choy","kale","chard","fennel"].some(c => n.includes(c))) return "Vegetables";
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
  if (n.includes("anthrosol") || n.includes("paddy") || n.includes("urban") || n.includes("technosol") || n.includes("plaggen")) return "Anthropogenic";
  return "Other";
}

export default function CropsConfig() {
  const crops = useGetCrops();
  const soilTypes = useGetSoilTypes();

  const [selectedCropId, setSelectedCropId] = useState<string>("");
  const [selectedSoilId, setSelectedSoilId] = useState<string>("");

  const cropsWithCategory = useMemo(
    () => (crops.data ?? []).map((c) => ({ ...c, category: getCropCategory(c.name, c.description) })),
    [crops.data]
  );

  const cropsByCategory = useMemo(() => {
    const grouped: Record<string, typeof cropsWithCategory> = {};
    cropsWithCategory.forEach((c) => {
      if (!grouped[c.category]) grouped[c.category] = [];
      grouped[c.category].push(c);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [cropsWithCategory]);

  const soilWithCategory = useMemo(
    () => (soilTypes.data ?? []).map((s) => ({ ...s, category: getSoilCategory(s.name) })),
    [soilTypes.data]
  );

  const soilsByCategory = useMemo(() => {
    const grouped: Record<string, typeof soilWithCategory> = {};
    soilWithCategory.forEach((s) => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [soilWithCategory]);

  const selectedCrop = cropsWithCategory.find((c) => String(c.id) === selectedCropId);
  const selectedSoil = soilWithCategory.find((s) => String(s.id) === selectedSoilId);

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          Crop & Soil Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select a crop or soil type to view detailed agronomic data · {crops.data?.length ?? "—"} crops · {soilTypes.data?.length ?? "—"} soil types
        </p>
      </div>

      <Tabs defaultValue="crops">
        <TabsList className="bg-muted">
          <TabsTrigger value="crops" className="gap-2">
            <Leaf className="w-3.5 h-3.5" />Crop Lookup
          </TabsTrigger>
          <TabsTrigger value="soils" className="gap-2">
            <Layers className="w-3.5 h-3.5" />Soil Lookup
          </TabsTrigger>
        </TabsList>

        {/* ===== CROP LOOKUP TAB ===== */}
        <TabsContent value="crops" className="space-y-5 mt-5">
          {/* Selection UI */}
          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Leaf className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Select a Crop</h3>
                  <p className="text-xs text-muted-foreground">Choose from {crops.data?.length ?? 0} crops across 9 categories</p>
                </div>
              </div>
              {crops.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedCropId} onValueChange={setSelectedCropId}>
                  <SelectTrigger className="bg-muted border-input h-10">
                    <SelectValue placeholder="Select a crop to view detailed information…" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-card-border max-h-80 overflow-y-auto">
                    {cropsByCategory.map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                          {category}
                        </SelectLabel>
                        {items.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Detail panel — only after selection */}
          {!selectedCropId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/20">
              <Leaf className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No crop selected</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use the dropdown above to select a crop and view its detailed data</p>
            </div>
          ) : selectedCrop ? (
            <div className="space-y-4">
              {/* Header card */}
              <Card className="border-primary/20 bg-primary/3">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="text-lg font-bold">{selectedCrop.name}</h2>
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary/80 border-primary/20">
                          {selectedCrop.category}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          <Cloud className="w-2.5 h-2.5 mr-1" />{selectedCrop.waterRequirementMm}mm/season
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedCrop.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Water & Moisture */}
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      Water Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Ideal Soil Moisture Range</span>
                        <span className="font-bold text-primary">{selectedCrop.idealMoistureMin}–{selectedCrop.idealMoistureMax}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                        <div
                          className="absolute top-0 h-full bg-primary/30 rounded-full"
                          style={{ left: `${selectedCrop.idealMoistureMin}%`, width: `${selectedCrop.idealMoistureMax - selectedCrop.idealMoistureMin}%` }}
                        />
                        <div className="absolute top-0 h-full w-1 bg-primary rounded-full" style={{ left: `${selectedCrop.idealMoistureMin}%` }} />
                        <div className="absolute top-0 h-full w-1 bg-primary rounded-full" style={{ left: `${selectedCrop.idealMoistureMax}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0%</span>
                        <span className="text-primary">{selectedCrop.idealMoistureMin}%–{selectedCrop.idealMoistureMax}% optimal</span>
                        <span>100%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                        <div className="text-[10px] text-muted-foreground mb-1">Water Requirement</div>
                        <div className="text-xl font-bold text-blue-400">{selectedCrop.waterRequirementMm}</div>
                        <div className="text-[10px] text-muted-foreground">mm/season</div>
                      </div>
                      <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
                        <div className="text-[10px] text-muted-foreground mb-1">Optimal Moisture</div>
                        <div className="text-xl font-bold text-primary">{Math.round((selectedCrop.idealMoistureMin + selectedCrop.idealMoistureMax) / 2)}%</div>
                        <div className="text-[10px] text-muted-foreground">midpoint target</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Growth stages */}
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Growth Stages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedCrop.growthStages.map((stage, i) => (
                        <div key={stage} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40 border border-border">
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                            i === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {i + 1}
                          </div>
                          <span className={cn("text-xs", i === 0 ? "font-medium" : "text-muted-foreground")}>{stage}</span>
                          {i === 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto text-primary border-primary/40">Active</Badge>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ===== SOIL LOOKUP TAB ===== */}
        <TabsContent value="soils" className="space-y-5 mt-5">
          {/* Selection UI */}
          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Layers className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Select a Soil Type</h3>
                  <p className="text-xs text-muted-foreground">Choose from {soilTypes.data?.length ?? 0} soil types across multiple categories</p>
                </div>
              </div>
              {soilTypes.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedSoilId} onValueChange={setSelectedSoilId}>
                  <SelectTrigger className="bg-muted border-input h-10">
                    <SelectValue placeholder="Select a soil type to view detailed information…" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-card-border max-h-80 overflow-y-auto">
                    {soilsByCategory.map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                          {category}
                        </SelectLabel>
                        {items.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Soil detail panel */}
          {!selectedSoilId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/20">
              <Layers className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No soil type selected</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use the dropdown above to select a soil type and view its detailed data</p>
            </div>
          ) : selectedSoil ? (
            <div className="space-y-4">
              <Card className="border-amber-500/20 bg-amber-500/3">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="text-lg font-bold">{selectedSoil.name}</h2>
                        <Badge variant="outline" className="text-[10px]">{selectedSoil.category}</Badge>
                        <Badge variant="outline" className={cn("text-[10px] ml-auto capitalize", drainageColor[selectedSoil.drainageRate])}>
                          {selectedSoil.drainageRate} drainage
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedSoil.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Retention */}
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-400" />
                      Soil Water Retention
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Water Retention Capacity</span>
                        <span className="font-bold text-amber-400">{(selectedSoil.waterRetentionCapacity * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", selectedSoil.drainageRate === "fast" ? "bg-amber-500" : selectedSoil.drainageRate === "slow" ? "bg-blue-500" : "bg-primary")}
                          style={{ width: `${selectedSoil.waterRetentionCapacity * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 border border-border p-4">
                      <div className="text-[10px] text-muted-foreground mb-1">Irrigation Adjustment</div>
                      <div className="text-sm font-semibold">
                        {selectedSoil.drainageRate === "fast"
                          ? "+25% irrigation frequency, reduce interval"
                          : selectedSoil.drainageRate === "slow"
                          ? "−30% volume, improve field drainage"
                          : "Standard schedule, monitor closely"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Best crops */}
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-primary" />
                      Recommended Crops
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(selectedSoil.drainageRate === "fast"
                        ? ["Carrots", "Radish", "Garlic", "Groundnuts", "Sandy-adapted cereals"]
                        : selectedSoil.drainageRate === "slow"
                        ? ["Rice", "Sugarcane", "Taro", "Paddy crops", "Wetland vegetables"]
                        : ["Wheat", "Maize", "Tomato", "Soybean", "Potato"]
                      ).map((crop) => (
                        <div key={crop} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/40 border border-border text-xs">
                          <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />
                          <span>{crop}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
