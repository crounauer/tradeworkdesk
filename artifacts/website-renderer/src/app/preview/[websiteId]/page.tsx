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
import SiteLayout from "@/components/layout/SiteLayout";
import BlockRenderer from "@/components/blocks/BlockRenderer";

// Always fresh — never cache preview renders
export const revalidate = 0;

interface PageProps {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<{ page?: string }>;
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
  const { page: pageSlug } = await searchParams;

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
    <SiteLayout site={site}>
      {/* Preview banner */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#1e293b",
          color: "#f1f5f9",
          fontSize: "0.75rem",
          fontFamily: "system-ui, sans-serif",
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ background: "#f97316", borderRadius: "4px", padding: "2px 8px", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Preview
        </span>
        <span style={{ opacity: 0.7 }}>
          {page.title} — {site.website.site_name}
          {page.status === "draft" && " (draft)"}
        </span>
      </div>
      {/* Push content below the banner */}
      <div style={{ paddingTop: "32px" }}>
        <main>
          {blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
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
      </div>
    </SiteLayout>
  );
}
