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
}

export default async function PageRenderer({ websiteId, slug, page, theme }: Props) {
  const fullPage = await getPageBySlug(websiteId, slug);
  if (!fullPage) notFound();

  return (
    <main>
      {fullPage.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} theme={theme} />
      ))}
    </main>
  );
}
