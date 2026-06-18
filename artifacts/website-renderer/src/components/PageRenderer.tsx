/**
 * PageRenderer: fetches a page's blocks and renders them.
 * Server component — fetches at request/revalidation time.
 */
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/api";
import type { SitePage } from "@/lib/api";
import BlockRenderer from "./blocks/BlockRenderer";

interface Props {
  websiteId: string;
  slug: string;
  page: SitePage;
  /** Site-level theme overrides (e.g. accent_color) applied to every block */
  theme?: Record<string, string>;
  /** Tenant ID injected into blocks that call the public API */
  tenantId?: string;
}

export default async function PageRenderer({ websiteId, slug, page, theme, tenantId }: Props) {
  const fullPage = await getPageBySlug(websiteId, slug);
  if (!fullPage) notFound();

  return (
    <main>
      {fullPage.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} websiteId={websiteId} theme={theme} tenantId={tenantId} />
      ))}
    </main>
  );
}
