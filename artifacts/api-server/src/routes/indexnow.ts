import { Router, type Request, type Response } from "express";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

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
  "https://www.tradeworkdesk.co.uk/blog/how-to-go-paperless-as-a-gas-engineer",
  "https://www.tradeworkdesk.co.uk/blog/gas-safe-record-keeping-guide",
  "https://www.tradeworkdesk.co.uk/blog/best-software-for-heating-engineers",
  "https://www.tradeworkdesk.co.uk/blog/managing-boiler-service-contracts",
  "https://www.tradeworkdesk.co.uk/blog/heat-pump-service-software",
  "https://www.tradeworkdesk.co.uk/privacy-policy",
  "https://www.tradeworkdesk.co.uk/terms-of-service",
];

const HOST = "www.tradeworkdesk.co.uk";

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

  const allowedPrefix = `https://${HOST}/`;
  const invalidUrls = urlList.filter((u) => !u.startsWith(allowedPrefix) && u !== `https://${HOST}`);
  if (invalidUrls.length > 0) {
    res.status(400).json({ error: "All URLs must belong to " + HOST, invalid: invalidUrls });
    return;
  }

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `https://${HOST}/${key}.txt`,
        urlList,
      }),
    });

    const responseBody = await response.text();
    const upstreamStatus = response.status;

    if (upstreamStatus === 200 || upstreamStatus === 202) {
      res.json({
        success: true,
        submitted: urlList.length,
        upstreamStatus,
        upstreamBody: responseBody || null,
      });
    } else {
      res.status(upstreamStatus).json({
        success: false,
        error: "IndexNow API error",
        upstreamStatus,
        upstreamBody: responseBody || null,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to contact IndexNow API", detail: String(err) });
  }
});

export default router;
