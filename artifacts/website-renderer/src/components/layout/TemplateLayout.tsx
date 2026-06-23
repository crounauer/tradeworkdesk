/**
 * TemplateLayout — renders the website wrapper based on the template configured in the database.
 *
 * If no template is configured, returns blank (no layout).
 * Superadmin must upload and set a template via the admin panel for the site to render.
 */
import type { TemplateLayoutProps } from "./templates/types";

export default function TemplateLayout(props: TemplateLayoutProps) {
  const templateSlug = props.site.website.template_slug;
  
  console.log("[TemplateLayout] template_slug:", templateSlug);
  console.log("[TemplateLayout] website:", props.site.website);

  // No template available — superadmin must upload and configure one
  if (!templateSlug) {
    console.log("[TemplateLayout] No template configured - returning null");
    return null;
  }

  // Template exists but no component mapped to it
  console.log("[TemplateLayout] Template exists but no component:", templateSlug);
  return null;
}
