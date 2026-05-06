import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, cropsTable } from "@workspace/db";
import {
  GetCropsResponse,
  GetCropParams,
  GetCropResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatCrop(c: {
  id: number;
  name: string;
  idealMoistureMin: number;
  idealMoistureMax: number;
  waterRequirementMm: number;
  growthStages: string[];
  description: string;
}) {
  return {
    id: c.id,
    name: c.name,
    idealMoistureMin: c.idealMoistureMin,
    idealMoistureMax: c.idealMoistureMax,
    waterRequirementMm: c.waterRequirementMm,
    growthStages: c.growthStages,
    description: c.description,
    currentStage: null,
  };
}

router.get("/crops", async (_req, res): Promise<void> => {
  const crops = await db.select().from(cropsTable).orderBy(cropsTable.name);
  res.json(GetCropsResponse.parse(crops.map(formatCrop)));
});

router.get("/crops/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCropParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [crop] = await db.select().from(cropsTable).where(eq(cropsTable.id, params.data.id));
  if (!crop) {
    res.status(404).json({ error: "Crop not found" });
    return;
  }

  res.json(GetCropResponse.parse(formatCrop(crop)));
});

export default router;
