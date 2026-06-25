/**
 * Admin Routes
 * Aggregates all admin-level template management routes
 */

import { Router } from "express";
import templatesRouter from "./templates";
import buildsRouter from "./builds";

const router = Router();

// Mount admin template management routes
router.use("/templates", templatesRouter);
router.use("/template-builds", buildsRouter);

export default router;
