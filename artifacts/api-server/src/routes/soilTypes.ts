import { Router, type IRouter } from "express";
import { db, soilTypesTable } from "@workspace/db";
import { GetSoilTypesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/soil-types", async (_req, res): Promise<void> => {
  const soilTypes = await db.select().from(soilTypesTable).orderBy(soilTypesTable.name);
  const result = soilTypes.map((s) => ({
    id: s.id,
    name: s.name,
    waterRetentionCapacity: s.waterRetentionCapacity,
    drainageRate: s.drainageRate as "slow" | "medium" | "fast",
    description: s.description,
  }));

  res.json(GetSoilTypesResponse.parse(result));
});

export default router;
