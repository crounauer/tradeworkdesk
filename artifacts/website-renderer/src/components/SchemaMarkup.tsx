// Server component — renders JSON-LD structured data for SEO.
// Google and other crawlers parse JSON-LD from anywhere in the document.
import type { SiteData } from "@/lib/api";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface Props {
  site: SiteData;
  domain: string;
  pageType?: "home" | "inner";
  breadcrumb?: BreadcrumbItem[];
}

export default function SchemaMarkup({ site, domain, pageType = "inner", breadcrumb }: Props) {
  const { website, company } = site;
  const siteUrl = `https://${domain}`;
  const displayName = company?.trading_name || company?.name || website.site_name;

  const schemas: object[] = [];

  // ── LocalBusiness ────────────────────────────────────────────────────────
  const localBusiness: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: displayName,
    url: siteUrl,
  };

  if (company?.phone) localBusiness.telephone = company.phone;
  if (company?.email) localBusiness.email = company.email;
  if (website.tagline) localBusiness.description = website.tagline;
  if (website.logo_url) {
    localBusiness.logo = website.logo_url;
    localBusiness.image = website.logo_url;
  }

  if (company?.address_line1 || company?.city) {
    localBusiness.address = {
      "@type": "PostalAddress",
      ...(company?.address_line1 ? { streetAddress: company.address_line1 } : {}),
      ...(company?.city ? { addressLocality: company.city } : {}),
      ...(company?.county ? { addressRegion: company.county } : {}),
      ...(company?.postcode ? { postalCode: company.postcode } : {}),
      addressCountry: "GB",
    };
  }

  if (website.social_links) {
    const sameAs = Object.values(website.social_links).filter(Boolean);
    if (sameAs.length > 0) localBusiness.sameAs = sameAs;
  }

  schemas.push(localBusiness);

  // ── WebSite (homepage only) ──────────────────────────────────────────────
  if (pageType === "home") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: displayName,
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#business` },
    });
  }

  // ── BreadcrumbList (inner pages) ─────────────────────────────────────────
  if (breadcrumb && breadcrumb.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: displayName,
          item: siteUrl,
        },
        ...breadcrumb.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 2,
          name: crumb.name,
          item: crumb.url,
        })),
      ],
    });
  }

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
