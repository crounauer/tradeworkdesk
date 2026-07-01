import type { BlogPost, CompanySettings, SiteData } from "./api";

function cleanText(value: string | null | undefined): string {
  return String(value || "").trim();
}

function compactParts(parts: Array<string | null | undefined>): string[] {
  return parts.map((part) => cleanText(part)).filter(Boolean);
}

function displayName(site: SiteData): string {
  const company = site.company;
  return cleanText(company?.trading_name) || cleanText(company?.name) || cleanText(site.website.site_name) || "this business";
}

function serviceArea(company: CompanySettings | null): string {
  return compactParts([company?.city, company?.county, company?.service_area])[0] || "";
}

export function buildDefaultSiteDescription(site: SiteData): string {
  const configured = cleanText(site.website.default_meta_description) || cleanText(site.website.tagline);
  if (configured) return configured;

  const businessName = displayName(site);
  const area = serviceArea(site.company);
  return `${businessName} provides trusted heating, plumbing and boiler services${area ? ` in ${area}` : ""}. Get in touch for repairs, servicing and installations.`;
}

export function buildPageDescription(site: SiteData, pageTitle?: string | null): string {
  const configured = cleanText(site.website.default_meta_description);
  if (configured) return configured;

  const businessName = displayName(site);
  const area = serviceArea(site.company);
  const title = cleanText(pageTitle);

  if (title) {
    return `${title} from ${businessName}${area ? ` in ${area}` : ""}. Trusted heating, plumbing and boiler services.`;
  }

  return buildDefaultSiteDescription(site);
}

export function buildBlogDescription(site: SiteData, post?: BlogPost | null): string {
  const excerpt = cleanText(post?.excerpt) || cleanText(post?.meta_description);
  if (excerpt) return excerpt;

  const configured = cleanText(site.website.default_meta_description);
  if (configured) return configured;

  const businessName = displayName(site);
  const area = serviceArea(site.company);
  return `Advice, updates and practical tips from ${businessName}${area ? ` in ${area}` : ""}.`;
}
