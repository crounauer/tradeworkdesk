import { Router, type Request, type Response } from "express";
import { submitTenantIndexNow } from "../lib/indexnow-tenant";
import { requireAuth, requireRole, requireSuperAdmin, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

const DEFAULT_SITEMAP_URLS = [
  "https://www.tradeworkdesk.co.uk/",
  "https://www.tradeworkdesk.co.uk/features",
  "https://www.tradeworkdesk.co.uk/pricing",
  "https://www.tradeworkdesk.co.uk/about",
  "https://www.tradeworkdesk.co.uk/contact",
  "https://www.tradeworkdesk.co.uk/blog",
  "https://www.tradeworkdesk.co.uk/gas-engineer-software",
  "https://www.tradeworkdesk.co.uk/boiler-service-management-software",
  "https://www.tradeworkdesk.co.uk/job-management-software-heating-engineers",
  "https://www.tradeworkdesk.co.uk/oil-engineer-software",
  "https://www.tradeworkdesk.co.uk/heat-pump-engineer-software",
  "https://www.tradeworkdesk.co.uk/plumber-software",
  "https://www.tradeworkdesk.co.uk/landlord-gas-safety-software",
  "https://www.tradeworkdesk.co.uk/sole-trader-software",
  "https://www.tradeworkdesk.co.uk/heating-company-software",
  "https://www.tradeworkdesk.co.uk/industries",
  "https://www.tradeworkdesk.co.uk/alternatives",
  "https://www.tradeworkdesk.co.uk/blog/how-to-go-paperless-as-a-gas-engineer",
  "https://www.tradeworkdesk.co.uk/blog/gas-safe-record-keeping-guide",
  "https://www.tradeworkdesk.co.uk/blog/best-software-for-heating-engineers",
  "https://www.tradeworkdesk.co.uk/blog/managing-boiler-service-contracts",
  "https://www.tradeworkdesk.co.uk/blog/heat-pump-service-software",
  "https://www.tradeworkdesk.co.uk/privacy-policy",
  "https://www.tradeworkdesk.co.uk/terms-of-service",
];

const MARKETING_HOST = "www.tradeworkdesk.co.uk";

async function submitToIndexNow(host: string, key: string, urlList: string[]) {
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList,
    }),
  });

  return {
    upstreamStatus: response.status,
    upstreamBody: (await response.text()) || null,
  };
}

router.post("/indexnow/submit", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    res.status(500).json({ error: "INDEXNOW_KEY not configured" });
    return;
  }

  const { urls: requestedUrls } = req.body as { urls?: string[] };
  const urlList = Array.isArray(requestedUrls) && requestedUrls.length > 0
    ? requestedUrls
    : DEFAULT_SITEMAP_URLS;

  const allowedPrefix = `https://${MARKETING_HOST}/`;
  const invalidUrls = urlList.filter((u) => !u.startsWith(allowedPrefix) && u !== `https://${MARKETING_HOST}`);
  if (invalidUrls.length > 0) {
    res.status(400).json({ error: "All URLs must belong to " + MARKETING_HOST, invalid: invalidUrls });
    return;
  }

  try {
    const { upstreamStatus, upstreamBody } = await submitToIndexNow(MARKETING_HOST, key, urlList);

    if (upstreamStatus === 200 || upstreamStatus === 202) {
      res.json({
        success: true,
        submitted: urlList.length,
        upstreamStatus,
        upstreamBody,
      });
    } else {
      res.status(upstreamStatus).json({
        success: false,
        error: "IndexNow API error",
        upstreamStatus,
        upstreamBody,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to contact IndexNow API", detail: String(err) });
  }
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
