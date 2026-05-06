import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import zonesRouter from "./zones";
import pumpsRouter from "./pumps";
import sensorsRouter from "./sensors";
import weatherRouter from "./weather";
import irrigationRouter from "./irrigation";
import alertsRouter from "./alerts";
import cropsRouter from "./crops";
import soilTypesRouter from "./soilTypes";
import aiRouter from "./ai";
import waterUsageRouter from "./waterUsage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(zonesRouter);
router.use(pumpsRouter);
router.use(sensorsRouter);
router.use(weatherRouter);
router.use(irrigationRouter);
router.use(alertsRouter);
router.use(cropsRouter);
router.use(soilTypesRouter);
router.use(aiRouter);
router.use(waterUsageRouter);

export default router;
