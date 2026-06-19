import { supabaseAdmin } from "./supabase";

const db = supabaseAdmin as any;

type TenantIndexNowResult = {
  host: string;
  submitted: number;
  upstreamStatus: number;
  success: boolean;
  upstreamBody: string | null;
};

type TenantIndexNowResponse = {
  success: boolean;
  submitted: number;
  hostsSucceeded: number;
  hostsFailed: number;
  results: TenantIndexNowResult[];
  error?: string;
};

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

export async function submitTenantIndexNow(tenantId: string): Promise<TenantIndexNowResponse> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { success: false, submitted: 0, hostsSucceeded: 0, hostsFailed: 1, results: [], error: "INDEXNOW_KEY not configured" };
  }

  const { data: website } = await db
    .from("websites")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle() as { data: { id: string } | null };

  if (!website) {
    return { success: false, submitted: 0, hostsSucceeded: 0, hostsFailed: 1, results: [], error: "No website found for this tenant" };
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
    return {
      success: false,
      submitted: 0,
      hostsSucceeded: 0,
      hostsFailed: 1,
      results: [],
      error: "No active website domains found. Publish your site and activate a domain first.",
    };
  }

  const activeCustomDomains = activeDomains.filter((d) => !d.is_platform_subdomain);
  const selectedHost =
    activeCustomDomains.find((d) => d.is_primary)?.domain
    || activeCustomDomains[0]?.domain
    || activeDomains.find((d) => d.is_platform_subdomain)?.domain
    || activeDomains[0]?.domain;

  if (!selectedHost) {
    return { success: false, submitted: 0, hostsSucceeded: 0, hostsFailed: 1, results: [], error: "No active website domain found to submit" };
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
    return { success: false, submitted: 0, hostsSucceeded: 0, hostsFailed: 1, results: [], error: "No published website URLs found to submit" };
  }

  const urlList = uniquePaths.map((path) => (path === "/" ? `https://${selectedHost}` : `https://${selectedHost}${path}`));

  try {
    const { upstreamStatus, upstreamBody } = await submitToIndexNow(selectedHost, key, urlList);
    const result: TenantIndexNowResult = {
      host: selectedHost,
      submitted: urlList.length,
      upstreamStatus,
      success: upstreamStatus === 200 || upstreamStatus === 202,
      upstreamBody,
    };

    return {
      success: result.success,
      submitted: result.submitted,
      hostsSucceeded: result.success ? 1 : 0,
      hostsFailed: result.success ? 0 : 1,
      results: [result],
      ...(result.success ? {} : { error: "Tenant IndexNow submission failed" }),
    };
  } catch (err) {
    return {
      success: false,
      submitted: urlList.length,
      hostsSucceeded: 0,
      hostsFailed: 1,
      results: [{ host: selectedHost, submitted: urlList.length, upstreamStatus: 500, success: false, upstreamBody: String(err) }],
      error: "Failed to contact IndexNow API",
    };
  }
}

export function triggerTenantIndexNowAutoSubmit(tenantId: string, reason: string) {
  void submitTenantIndexNow(tenantId)
    .then((result) => {
      console.log(`[indexnow:auto] tenant=${tenantId} reason=${reason} success=${result.success} submitted=${result.submitted}`);
    })
    .catch((err) => {
      console.error(`[indexnow:auto] tenant=${tenantId} reason=${reason} failed`, err);
    });
}
