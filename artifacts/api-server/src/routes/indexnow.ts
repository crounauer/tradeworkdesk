import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, requireSuperAdmin, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
const db = supabaseAdmin as any;

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

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "");
  return normalized || "/";
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
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
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    res.status(500).json({ error: "INDEXNOW_KEY not configured" });
    return;
  }

  if (!req.tenantId) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return;
  }

  const { data: website } = await db
    .from("websites")
    .select("id")
    .eq("tenant_id", req.tenantId)
    .maybeSingle() as { data: { id: string } | null };

  if (!website) {
    res.status(404).json({ error: "No website found for this tenant" });
    return;
  }

  const [domainsRes, pagesRes, postsRes] = await Promise.all([
    db.from("website_domains").select("domain, is_active, is_platform_subdomain, is_primary").eq("website_id", website.id).eq("is_active", true),
    db
      .from("website_pages")
      .select("slug, page_type, no_index")
      .eq("website_id", website.id)
      .eq("status", "published"),
    db
      .from("website_blog_posts")
      .select("slug")
      .eq("website_id", website.id)
      .eq("status", "published"),
  ]) as Array<{ data: unknown[] | null }>;

  const activeDomains = ((domainsRes.data ?? []) as Array<{
    domain: string;
    is_active: boolean;
    is_platform_subdomain: boolean;
    is_primary: boolean | null;
  }>).filter((d) => !!d.domain);

  if (activeDomains.length === 0) {
    res.status(400).json({ error: "No active website domains found. Publish your site and activate a domain first." });
    return;
  }

  // Submit only one hostname: prefer active custom primary domain, then any active custom domain,
  // and only fall back to the platform subdomain when no custom domain is active.
  const activeCustomDomains = activeDomains.filter((d) => !d.is_platform_subdomain);
  const selectedHost =
    activeCustomDomains.find((d) => d.is_primary)?.domain
    || activeCustomDomains[0]?.domain
    || activeDomains.find((d) => d.is_platform_subdomain)?.domain
    || activeDomains[0]?.domain;

  if (!selectedHost) {
    res.status(400).json({ error: "No active website domain found to submit" });
    return;
  }

  const pagePaths = ((pagesRes.data ?? []) as Array<{ slug: string; page_type: string; no_index: boolean | null }>)
    .filter((p) => !p.no_index)
    .map((p) => {
      if (p.page_type === "home") return "/";
      return normalizePath(p.slug || "/");
    });

  const blogPaths = ((postsRes.data ?? []) as Array<{ slug: string }>)
    .filter((p) => !!p.slug)
    .map((p) => normalizePath(`/blog/${p.slug}`));

  const uniquePaths = dedupe(["/", ...pagePaths, ...blogPaths]);
  if (uniquePaths.length === 0) {
    res.status(400).json({ error: "No published website URLs found to submit" });
    return;
  }

  const results: Array<{ host: string; submitted: number; upstreamStatus: number; success: boolean; upstreamBody: string | null }> = [];

  const urlList = uniquePaths.map((path) => (path === "/" ? `https://${selectedHost}` : `https://${selectedHost}${path}`));
  try {
    const { upstreamStatus, upstreamBody } = await submitToIndexNow(selectedHost, key, urlList);
    results.push({
      host: selectedHost,
      submitted: urlList.length,
      upstreamStatus,
      success: upstreamStatus === 200 || upstreamStatus === 202,
      upstreamBody,
    });
  } catch (err) {
    results.push({
      host: selectedHost,
      submitted: urlList.length,
      upstreamStatus: 500,
      success: false,
      upstreamBody: String(err),
    });
  }

  const submitted = results.reduce((sum, item) => sum + item.submitted, 0);
  const hostsSucceeded = results.filter((item) => item.success).length;
  const hostsFailed = results.length - hostsSucceeded;

  if (hostsSucceeded === 0) {
    res.status(502).json({
      success: false,
      error: "All tenant IndexNow submissions failed",
      submitted,
      hostsSucceeded,
      hostsFailed,
      results,
    });
    return;
  }

  res.json({
    success: true,
    submitted,
    hostsSucceeded,
    hostsFailed,
    results,
  });
});

export default router;
