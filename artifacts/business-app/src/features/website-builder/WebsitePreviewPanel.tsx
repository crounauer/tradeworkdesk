import TemplateRenderer from "@/templates/classic/TemplateRenderer";
import { classicTemplate } from "@/templates/classic/classic.template";
import { classicTheme } from "@/templates/classic/classic.theme";
import type { TenantWebsiteContent } from "./websiteBuilderTypes";

interface Props {
  pageSlug: string;
  content: TenantWebsiteContent;
}

export default function WebsitePreviewPanel({ pageSlug, content }: Props) {
  return (
    <TemplateRenderer
      template={classicTemplate}
      theme={classicTheme}
      content={content}
      pageSlug={pageSlug}
    />
  );
}
