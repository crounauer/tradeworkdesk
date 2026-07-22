import { supabaseAdmin } from "./supabase";

export const SOCIAL_POST_TYPES = ["business", "website_promotion"] as const;
export type SocialPostType = (typeof SOCIAL_POST_TYPES)[number];

export type WebsitePromotionUtm = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
};

type WebsitePageRow = {
  id: string;
  tenant_id: string;
  website_id: string;
  slug: string;
  title: string | null;
  status: string;
};

type DomainRow = {
  domain: string;
};

function normalizeUtmValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureHttps(urlString: string): string {
  const parsed = new URL(urlString);
  if (parsed.protocol !== "https:") {
    throw new Error("Website promotion URLs must use HTTPS");
  }
  return parsed.toString();
}

function buildPageUrl(domain: string, slug: string): string {
  const cleanDomain = String(domain || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!cleanDomain) throw new Error("No active website domain configured");

  const cleanSlug = String(slug || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const path = cleanSlug.length > 0 ? `/${cleanSlug}` : "";
  return ensureHttps(`https://${cleanDomain}${path}`);
}

export function buildUtmTaggedUrl(baseUrl: string, utm: WebsitePromotionUtm): string {
  const url = new URL(baseUrl);

  const source = normalizeUtmValue(utm.source);
  const medium = normalizeUtmValue(utm.medium);
  const campaign = normalizeUtmValue(utm.campaign);
  const content = normalizeUtmValue(utm.content);

  if (source) url.searchParams.set("utm_source", source);
  if (medium) url.searchParams.set("utm_medium", medium);
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);

  return url.toString();
}

export async function resolvePromotionPageUrl(opts: {
  tenantId: string;
  websitePageId: string;
  requirePublished: boolean;
}): Promise<{ pageId: string; title: string | null; slug: string; pageUrl: string }> {
  const { tenantId, websitePageId, requirePublished } = opts;

  let pageQuery = supabaseAdmin
    .from("website_pages")
    .select("id, tenant_id, website_id, slug, title, status")
    .eq("tenant_id", tenantId)
    .eq("id", websitePageId)
    .limit(1);

  if (requirePublished) {
    pageQuery = pageQuery.eq("status", "published");
  }

  const { data: page } = await pageQuery.single<WebsitePageRow>();

  if (!page) {
    if (requirePublished) {
      throw new Error("Selected website page does not exist or is not published");
    }
    throw new Error("Selected website page does not exist");
  }

  const { data: domainRow } = await supabaseAdmin
    .from("website_domains")
    .select("domain")
    .eq("website_id", page.website_id)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .single<DomainRow>();

  if (!domainRow?.domain) {
    throw new Error("No active website domain available for this tenant");
  }

  return {
    pageId: page.id,
    title: page.title,
    slug: page.slug,
    pageUrl: buildPageUrl(domainRow.domain, page.slug),
  };
}

export async function listPromotionPages(tenantId: string): Promise<Array<{
  id: string;
  title: string | null;
  slug: string;
  status: string;
  pageUrl: string | null;
}>> {
  const { data: pages } = await supabaseAdmin
    .from("website_pages")
    .select("id, tenant_id, website_id, slug, title, status")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("title", { ascending: true });

  if (!pages || pages.length === 0) return [];

  const byWebsite = new Map<string, string>();
  const websiteIds = Array.from(new Set(pages.map((p) => String((p as WebsitePageRow).website_id)).filter(Boolean)));

  if (websiteIds.length > 0) {
    const { data: domains } = await supabaseAdmin
      .from("website_domains")
      .select("website_id, domain, is_primary, is_active, created_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("website_id", websiteIds)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    for (const row of domains ?? []) {
      const websiteId = String((row as { website_id: string }).website_id || "");
      if (!websiteId || byWebsite.has(websiteId)) continue;
      const domain = String((row as { domain: string }).domain || "").trim();
      if (domain) byWebsite.set(websiteId, domain);
    }
  }

  return (pages as WebsitePageRow[]).map((p) => {
    const domain = byWebsite.get(p.website_id);
    const pageUrl = domain ? buildPageUrl(domain, p.slug) : null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      pageUrl,
    };
  });
}
