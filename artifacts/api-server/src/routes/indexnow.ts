import { Router, type Request, type Response } from "express";
import { submitMarketingIndexNow } from "../lib/indexnow-marketing";
import { submitTenantIndexNow } from "../lib/indexnow-tenant";
import { requireAuth, requireRole, requireSuperAdmin, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

router.post("/indexnow/submit", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { urls: requestedUrls } = req.body as { urls?: string[] };
  const result = await submitMarketingIndexNow(requestedUrls);
  if (!result.success) {
    res.status(result.upstreamStatus >= 400 ? result.upstreamStatus : 500).json(result);
    return;
  }
  res.json(result);
});

router.post("/indexnow/submit-tenant", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenantId) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return;
  }

  const result = await submitTenantIndexNow(req.tenantId);
  if (!result.success) {
    res.status(502).json(result);
    return;
  }
  res.json(result);
});

export default router;
