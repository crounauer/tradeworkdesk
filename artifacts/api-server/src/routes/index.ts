import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "./customers";
import propertiesRouter from "./properties";
import appliancesRouter from "./appliances";
import jobsRouter from "./jobs";
import serviceRecordsRouter from "./service-records";
import commissioningRecordsRouter from "./commissioning-records";
import breakdownReportsRouter from "./breakdown-reports";
import notesRouter from "./notes";
import filesRouter from "./files";
import signaturesRouter from "./signatures";
import searchRouter from "./search";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(customersRouter);
router.use(propertiesRouter);
router.use(appliancesRouter);
router.use(jobsRouter);
router.use(serviceRecordsRouter);
router.use(commissioningRecordsRouter);
router.use(breakdownReportsRouter);
router.use(notesRouter);
router.use(filesRouter);
router.use(signaturesRouter);
router.use(searchRouter);
router.use(reportsRouter);
router.use(dashboardRouter);

export default router;
