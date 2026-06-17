/**
 * TemplateLayout — picks the correct layout component based on website.template_id.
 *
 * Template IDs match the `id` column in the `website_templates` Supabase table.
 * Add new template_id mappings here as you create them.
 */
import type { ComponentType } from "react";
import type { TemplateLayoutProps } from "./templates/types";
import ClassicTemplate from "./templates/ClassicTemplate";
import ModernTemplate from "./templates/ModernTemplate";
import BoldTemplate from "./templates/BoldTemplate";
import ProfessionalTemplate from "./templates/ProfessionalTemplate";
import MinimalTemplate from "./templates/MinimalTemplate";

const TEMPLATE_MAP: Record<string, ComponentType<TemplateLayoutProps>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  bold: BoldTemplate,
  professional: ProfessionalTemplate,
  minimal: MinimalTemplate,
};

export default function TemplateLayout(props: TemplateLayoutProps) {
  const templateId = props.site.website.template_slug ?? props.site.website.template_id ?? "classic";
  const Layout = TEMPLATE_MAP[templateId] ?? ClassicTemplate;
  return <Layout {...props} />;
}
