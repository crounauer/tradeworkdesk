import { Router, type Request, type Response } from "express";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router = Router();

router.post("/indexnow/submit", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    res.status(500).json({ error: "INDEXNOW_KEY not configured" });
    return;
  }

  const { urls } = req.body as { urls?: string[] };
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: "urls array is required" });
    return;
  }

  const host = "boilertech.replit.app";
  const allowedPrefix = `https://${host}/`;
  const invalidUrls = urls.filter((u) => !u.startsWith(allowedPrefix) && u !== `https://${host}`);
  if (invalidUrls.length > 0) {
    res.status(400).json({ error: "All URLs must belong to " + host, invalid: invalidUrls });
    return;
  }

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls,
      }),
    });

    if (response.ok || response.status === 200 || response.status === 202) {
      res.json({ success: true, submitted: urls.length, status: response.status });
    } else {
      const text = await response.text();
      res.status(response.status).json({ error: "IndexNow API error", detail: text });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to contact IndexNow API", detail: String(err) });
  }
});

export default router;
