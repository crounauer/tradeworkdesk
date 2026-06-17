import type { ReactNode } from "react";
import type { SiteData } from "@/lib/api";

export interface TemplateLayoutProps {
  site: SiteData;
  children: ReactNode;
  basePath?: string;
  previewToken?: string;
}
