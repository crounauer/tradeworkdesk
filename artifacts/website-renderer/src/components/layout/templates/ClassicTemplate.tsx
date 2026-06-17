/**
 * Template: classic
 * Style: Dark navy header, traditional tradesperson layout.
 * This is the default template (matches the original SiteLayout).
 */
import type { TemplateLayoutProps } from "./types";
import SiteHeader from "../SiteHeader";
import SiteFooter from "../SiteFooter";
import GoogleAnalytics from "../GoogleAnalytics";

export default function ClassicTemplate({ site, children, basePath, previewToken }: TemplateLayoutProps) {
  const { website, company } = site;
  const navPages = site.pages.filter((p) => p.show_in_nav);

  return (
    <>
      {website.google_analytics_id && <GoogleAnalytics trackingId={website.google_analytics_id} />}
      <SiteHeader
        siteName={website.site_name}
        logoUrl={website.logo_url}
        pages={navPages}
        theme={website.theme as Record<string, string>}
        company={company}
        basePath={basePath}
        previewToken={previewToken}
      />
      <div style={{ minHeight: "60vh" }}>{children}</div>
      <SiteFooter
        siteName={website.site_name}
        logoUrl={website.logo_url}
        tagline={website.tagline}
        company={company}
        socialLinks={website.social_links}
        theme={website.theme as Record<string, string>}
        pages={navPages}
      />
    </>
  );
}
