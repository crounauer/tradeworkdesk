import type { ReactNode } from "react";
import type { SiteData } from "@/lib/api";
import { getPageBySlug, getPreviewBlocksByPageId } from "@/lib/api";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import GoogleAnalytics from "./GoogleAnalytics";
import AdminEditPageButton from "@/components/AdminEditPageButton";

const GLOBAL_SITE_HEADER_THEME_KEY = "__site_header_content";
const GLOBAL_SITE_FOOTER_THEME_KEY = "__site_footer_content";

interface Props {
  site: SiteData;
  children: ReactNode;
  basePath?: string;
  previewToken?: string;
}

export default async function SiteLayout({ site, children, basePath, previewToken }: Props) {
  const { website, company } = site;
  const appBaseUrl = process.env.NEXT_PUBLIC_BUSINESS_APP_URL || process.env.BUSINESS_APP_URL || "https://tradeworkdesk.co.uk";

  const navPages = site.pages.filter((p) => p.show_in_nav);
  const themeObject = (website.theme && typeof website.theme === "object") ? website.theme as Record<string, unknown> : {};
  let headerContent: Record<string, unknown> | null = (
    themeObject[GLOBAL_SITE_HEADER_THEME_KEY]
    && typeof themeObject[GLOBAL_SITE_HEADER_THEME_KEY] === "object"
  ) ? (themeObject[GLOBAL_SITE_HEADER_THEME_KEY] as Record<string, unknown>) : null;
  const footerContent: Record<string, unknown> | null = (
    themeObject[GLOBAL_SITE_FOOTER_THEME_KEY]
    && typeof themeObject[GLOBAL_SITE_FOOTER_THEME_KEY] === "object"
  ) ? (themeObject[GLOBAL_SITE_FOOTER_THEME_KEY] as Record<string, unknown>) : null;
  const hasThemeHeaderContent = Boolean(headerContent);
  let hasHeaderBlockContent = false;

  try {
    if (!headerContent) {
      const homePage =
        site.pages.find((p) => p.page_type === "home")
        || site.pages.find((p) => p.slug === "/" || p.slug === "home" || p.slug === "/home");

      if (homePage?.id) {
        const previewMode = Boolean(basePath && basePath.startsWith("/preview/"));
        const blocks = previewMode
          ? await getPreviewBlocksByPageId(homePage.id)
          : (await getPageBySlug(website.id, String(homePage.slug || "home").replace(/^\//, "") || "home"))?.blocks || [];

        const headerBlock = blocks.find((block) => {
          const t = String(block.block_type || "").toLowerCase().trim();
          return t === "site.header" || t === "site_header" || t === "header";
        });

        if (headerBlock?.content && typeof headerBlock.content === "object") {
          headerContent = headerBlock.content as Record<string, unknown>;
          hasHeaderBlockContent = true;
        }
      }
    }
  } catch (error) {
    console.error("[SiteLayout] Unable to resolve header block content", error);
  }

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
        headerContent={headerContent}
        templateSlug={website.template_slug || undefined}
        theme={website.theme as Record<string, string>}
        basePath={basePath}
        previewToken={previewToken}
        showTopBar={hasThemeHeaderContent || hasHeaderBlockContent}
      />
      <div id="main-content" style={{ minHeight: "60vh" }}>{children}</div>
      <SiteFooter
        siteName={website.site_name}
        company={company}
        socialLinks={website.social_links}
        theme={website.theme as Record<string, string>}
        templateSlug={website.template_slug || undefined}
        pages={navPages}
        tagline={website.tagline}
        logoUrl={website.logo_url}
        footerContent={footerContent}
      />
      <AdminEditPageButton pages={site.pages} appBaseUrl={appBaseUrl} />
    </>
  );
}
