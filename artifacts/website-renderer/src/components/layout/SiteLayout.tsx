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
          left: "-9999px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          el.style.left = "8px";
          el.style.top = "8px";
          el.style.width = "auto";
          el.style.height = "auto";
          el.style.overflow = "visible";
          el.style.zIndex = "9999";
          el.style.padding = "8px 16px";
          el.style.background = "#fff";
          el.style.color = "#111";
          el.style.borderRadius = "4px";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
          el.style.textDecoration = "none";
          el.style.fontWeight = "600";
        }}
        onBlur={(e) => {
          const el = e.currentTarget;
          el.style.left = "-9999px";
          el.style.top = "auto";
          el.style.width = "1px";
          el.style.height = "1px";
          el.style.overflow = "hidden";
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
