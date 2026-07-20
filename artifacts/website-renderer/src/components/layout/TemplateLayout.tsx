/**
 * TemplateLayout — renders the website wrapper based on the template configured in the database.
 *
 * Falls back to the generic site layout so previews and live pages always render,
 * even when a specific template component has not been wired yet.
 */
import SiteLayout from "./SiteLayout";
import WebsiteTrafficTracker from "@/components/WebsiteTrafficTracker";
import type { TemplateLayoutProps } from "./templates/types";

export default function TemplateLayout(props: TemplateLayoutProps) {
  // Template-specific layout mappings can be added here later.
  const analyticsEnabled = !props.basePath?.startsWith("/preview/");

  return (
    <SiteLayout site={props.site} basePath={props.basePath} previewToken={props.previewToken}>
      <WebsiteTrafficTracker websiteId={props.site.website.id} enabled={analyticsEnabled} />
      {props.children}
    </SiteLayout>
  );
}
