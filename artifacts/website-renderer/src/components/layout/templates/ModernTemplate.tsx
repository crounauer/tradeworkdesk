/**
 * Template: modern
 * Style: White header with teal accent bar. Clean, split-hero layout.
 * Matches the Figma "Modern" design with teal accent colour.
 */
import type { TemplateLayoutProps } from "./types";
import SiteHeader from "../SiteHeader";
import SiteFooter from "../SiteFooter";
import GoogleAnalytics from "../GoogleAnalytics";

export default function ModernTemplate({ site, children, basePath, previewToken }: TemplateLayoutProps) {
  const { website, company } = site;
  const navPages = site.pages.filter((p) => p.show_in_nav);
  const rawTheme = website.theme as Record<string, string>;
  const accent = rawTheme?.accent_color || "#0d9488";

  // Modern template always uses white header
  const theme: Record<string, string> = {
    ...rawTheme,
    nav_background: "#ffffff",
    nav_text: "#111827",
    accent_color: accent,
  };

  return (
    <>
      {website.google_analytics_id && <GoogleAnalytics trackingId={website.google_analytics_id} />}
      {/* Teal accent bar above header */}
      <div style={{ height: 4, backgroundColor: accent }} />
      <SiteHeader
        siteName={website.site_name}
        logoUrl={website.logo_url}
        pages={navPages}
        theme={theme}
        company={company}
        basePath={basePath}
        previewToken={previewToken}
      />
      <main style={{ minHeight: "60vh" }}>{children}</main>
      <SiteFooter
        siteName={website.site_name}
        logoUrl={website.logo_url}
        tagline={website.tagline}
        company={company}
        socialLinks={website.social_links}
        theme={theme}
        pages={navPages}
      />
    </>
  );
}
