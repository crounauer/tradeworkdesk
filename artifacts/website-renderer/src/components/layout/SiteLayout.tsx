import type { ReactNode } from "react";
import type { SiteData } from "@/lib/api";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import GoogleAnalytics from "./GoogleAnalytics";

interface Props {
  site: SiteData;
  children: ReactNode;
  basePath?: string;
  previewToken?: string;
}

export default function SiteLayout({ site, children, basePath, previewToken }: Props) {
  const { website, company } = site;

  const navPages = site.pages.filter((p) => p.show_in_nav);

  return (
    <>
      {website.google_analytics_id && (
        <GoogleAnalytics trackingId={website.google_analytics_id} />
      )}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "8px",
          top: "8px",
          width: "auto",
          height: "auto",
          overflow: "hidden",
          zIndex: "9999",
          padding: "8px 16px",
          background: "#fff",
          color: "#111",
          borderRadius: "4px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          textDecoration: "none",
          fontWeight: "600",
        }}
      >
        Skip to main content
      </a>
      <SiteHeader
        siteName={website.site_name}
        logoUrl={website.logo_url}
        pages={navPages}
        company={company}
        theme={website.theme as Record<string, string>}
        basePath={basePath}
        previewToken={previewToken}
      />
      <div id="main-content" style={{ minHeight: "60vh" }}>{children}</div>
      <SiteFooter
        siteName={website.site_name}
        company={company}
        socialLinks={website.social_links}
        theme={website.theme as Record<string, string>}
        pages={navPages}
        tagline={website.tagline}
        logoUrl={website.logo_url}
      />
    </>
  );
}
