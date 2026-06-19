/**
 * /preview/[websiteId]          — preview home page (no domain required)
 * /preview/[websiteId]?page=slug — preview a specific page
 *
 * Used by the business app's in-app preview before a custom domain is connected.
 * Returns all pages including draft content.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByWebsiteId, getPreviewBlocksByPageId } from "@/lib/api";
import TemplateLayout from "@/components/layout/TemplateLayout";
import BlockRenderer from "@/components/blocks/BlockRenderer";
import WebsiteClosureNotice from "@/components/WebsiteClosureNotice";
import PlatformAnnouncementsNotice from "@/components/PlatformAnnouncementsNotice";

// Always fresh — never cache preview renders
export const revalidate = 0;

interface PageProps {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<{ page?: string; token?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { websiteId } = await params;
  const site = await getSiteByWebsiteId(websiteId);
  if (!site) return {};
  return {
    title: `Preview — ${site.website.site_name}`,
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({ params, searchParams }: PageProps) {
  const { websiteId } = await params;
  const { page: pageSlug, token } = await searchParams;

  // Validate HMAC token when RENDERER_PREVIEW_SECRET is configured
  const secret = process.env.RENDERER_PREVIEW_SECRET;
  if (secret) {
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", secret).update(websiteId).digest("hex");
    const provided = token ?? "";
    const valid =
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
    if (!valid) notFound();
  }

  const site = await getSiteByWebsiteId(websiteId);
  if (!site) notFound();

  // Resolve which page to show
  let page = pageSlug
    ? site.pages.find((p) => p.slug === pageSlug || p.slug === `/${pageSlug}`)
    : site.pages.find((p) => p.page_type === "home" || p.slug === "/" || p.slug === "home");

  if (!page) page = site.pages[0];
  if (!page) notFound();

  // Fetch blocks (includes draft content)
  const blocks = await getPreviewBlocksByPageId(page.id);

  return (
    <TemplateLayout site={site} basePath={`/preview/${websiteId}`} previewToken={token}>
      <WebsiteClosureNotice company={site.company} />
      <PlatformAnnouncementsNotice announcements={site.platform_announcements} />
      <main>
        {blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} websiteId={websiteId} />
        ))}
        {blocks.length === 0 && (
          <div
            style={{
              padding: "80px 24px",
              textAlign: "center",
              color: "#94a3b8",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <p style={{ fontSize: "1.125rem", marginBottom: 8 }}>This page has no content blocks yet.</p>
            <p style={{ fontSize: "0.875rem" }}>Go to Website → Pages to start editing.</p>
          </div>
        )}
      </main>
    </TemplateLayout>
  );
}
