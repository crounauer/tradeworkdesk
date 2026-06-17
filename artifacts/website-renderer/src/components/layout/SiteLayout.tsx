import type { ReactNode } from "react";
import type { SiteData } from "@/lib/api";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import GoogleAnalytics from "./GoogleAnalytics";

interface Props {
  site: SiteData;
  children: ReactNode;
  basePath?: string;
}

export default function SiteLayout({ site, children, basePath }: Props) {
  const { website, company } = site;

  const navPages = site.pages.filter((p) => p.show_in_nav);

  return (
    <>
      {website.google_analytics_id && (
        <GoogleAnalytics trackingId={website.google_analytics_id} />
      )}
      <SiteHeader
        siteName={website.site_name}
        logoUrl={website.logo_url}
        pages={navPages}
        theme={website.theme as Record<string, string>}
        basePath={basePath}
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
