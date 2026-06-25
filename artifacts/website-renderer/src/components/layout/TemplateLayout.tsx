/**
 * TemplateLayout — renders the website wrapper based on the template configured in the database.
 *
 * Falls back to the generic site layout so previews and live pages always render,
 * even when a specific template component has not been wired yet.
 */
import SiteLayout from "./SiteLayout";
import type { TemplateLayoutProps } from "./templates/types";

export default function TemplateLayout(props: TemplateLayoutProps) {
  const templateSlug = props.site.website.template_slug;

  console.log("[TemplateLayout] template_slug:", templateSlug);

  // Template-specific layout mappings can be added here later.
  if (templateSlug) {
    console.log("[TemplateLayout] No specific template component found, using generic SiteLayout:", templateSlug);
  } else {
    console.log("[TemplateLayout] No template configured, using generic SiteLayout");
  }

  return (
    <SiteLayout site={props.site} basePath={props.basePath} previewToken={props.previewToken}>
      {props.children}
    </SiteLayout>
  );
}
