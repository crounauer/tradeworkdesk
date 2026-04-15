import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { geocodeAddress } from "../lib/geocode";

const router: IRouter = Router();

router.post("/geocode", requireAuth, requireTenant, requirePlanFeature("geo_mapping"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { address } = req.body;
  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "Address string is required" });
    return;
  }

  const result = await geocodeAddress(address, req.tenantId);
  if (!result) {
    res.status(404).json({ error: "Address not found" });
    return;
  }

  res.json(result);
});

export default router;
