/**
 * Template: professional
 * Style: Warm neutral tones, trust-focused layout for established tradespeople.
 * Scaffold — replace header/footer with Figma design implementation.
 */
import type { TemplateLayoutProps } from "./types";
import SiteHeader from "../SiteHeader";
import SiteFooter from "../SiteFooter";
import GoogleAnalytics from "../GoogleAnalytics";

export default function ProfessionalTemplate({ site, children, basePath, previewToken }: TemplateLayoutProps) {
  const { website, company } = site;
  const navPages = site.pages.filter((p) => p.show_in_nav);

  const theme = {
    ...(website.theme as Record<string, string>),
    nav_background: "#78350f",
    nav_text: "#fef3c7",
    footer_background: "#451a03",
    footer_text: "#d97706",
  };

  return (
    <>
      {website.google_analytics_id && <GoogleAnalytics trackingId={website.google_analytics_id} />}
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
        theme={theme}
      />
    </>
  );
}
