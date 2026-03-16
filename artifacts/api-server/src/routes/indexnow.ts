import { Router, type Request, type Response } from "express";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router = Router();

const DEFAULT_SITEMAP_URLS = [
  "https://boilertech.replit.app/",
  "https://boilertech.replit.app/features",
  "https://boilertech.replit.app/pricing",
  "https://boilertech.replit.app/about",
  "https://boilertech.replit.app/contact",
  "https://boilertech.replit.app/blog",
  "https://boilertech.replit.app/gas-engineer-software",
  "https://boilertech.replit.app/boiler-service-management-software",
  "https://boilertech.replit.app/job-management-software-heating-engineers",
  "https://boilertech.replit.app/blog/how-to-go-paperless-as-a-gas-engineer",
  "https://boilertech.replit.app/blog/gas-safe-record-keeping-guide",
  "https://boilertech.replit.app/blog/best-software-for-heating-engineers",
  "https://boilertech.replit.app/blog/managing-boiler-service-contracts",
  "https://boilertech.replit.app/blog/heat-pump-service-software",
  "https://boilertech.replit.app/privacy-policy",
  "https://boilertech.replit.app/terms-of-service",
];

const HOST = "boilertech.replit.app";

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
