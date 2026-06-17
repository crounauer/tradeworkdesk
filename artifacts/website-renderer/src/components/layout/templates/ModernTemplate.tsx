/**
 * Template: modern
 * Style: White header with coloured accent bar, clean and minimal.
 * Scaffold — replace header/footer with Figma design implementation.
 */
import type { TemplateLayoutProps } from "./types";
import SiteHeader from "../SiteHeader";
import SiteFooter from "../SiteFooter";
import GoogleAnalytics from "../GoogleAnalytics";

export default function ModernTemplate({ site, children, basePath, previewToken }: TemplateLayoutProps) {
  const { website, company } = site;
  const navPages = site.pages.filter((p) => p.show_in_nav);
  const accentColor = (website.theme as Record<string, string>)?.primary || "#2563eb";

  // Override theme to use light header style
  const theme = {
    ...(website.theme as Record<string, string>),
    nav_background: "#ffffff",
    nav_text: "#111827",
  };

  return (
    <>
      {website.google_analytics_id && <GoogleAnalytics trackingId={website.google_analytics_id} />}
      {/* Accent bar */}
      <div style={{ height: 4, backgroundColor: accentColor }} />
      <SiteHeader
        siteName={website.site_name}
        logoUrl={website.logo_url}
        pages={navPages}
        theme={theme}
        basePath={basePath}
        previewToken={previewToken}
      />
      <div style={{ minHeight: "60vh" }}>{children}</div>
      <SiteFooter
        siteName={website.site_name}
        company={company}
        socialLinks={website.social_links}
        theme={website.theme as Record<string, string>}
      />
    </>
  );
}
