import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import { getRequestDomain } from "@/lib/request-domain";
import TemplateLayout from "@/components/layout/TemplateLayout";
import PageRenderer from "@/components/PageRenderer";
import SchemaMarkup from "@/components/SchemaMarkup";
import WebsiteClosureNotice from "@/components/WebsiteClosureNotice";
import PlatformAnnouncementsNotice from "@/components/PlatformAnnouncementsNotice";

export const revalidate = 5;

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const domain = await getRequestDomain();
  const { slug } = await params;
  const slugStr = slug.join("/");

  const site = await getSiteByDomain(domain);
  if (!site) return {};

  const page = site.pages.find((p) => p.slug === slugStr || p.slug === `/${slugStr}`);
  if (!page) return {};

  const title = page.meta_title || `${page.title} | ${site.website.site_name}`;
  const description = page.meta_description || site.website.default_meta_description || undefined;
  const canonicalUrl = page.canonical_url || `https://${domain}/${slugStr}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: site.website.site_name,
      images: page.og_image_url ? [page.og_image_url] : [],
    },
    robots: page.no_index ? { index: false } : undefined,
  };
}

export default async function DynamicPage({ params }: PageProps) {
  const domain = await getRequestDomain();
  const { slug } = await params;
  const slugStr = slug.join("/");

  const site = await getSiteByDomain(domain);
  if (!site) notFound();

  const page = site.pages.find((p) => p.slug === slugStr || p.slug === `/${slugStr}`);
  if (!page) notFound();

  const siteTheme = site.website.theme as Record<string, string>;

  return (
    <TemplateLayout site={site}>
      <WebsiteClosureNotice company={site.company} />
      <PlatformAnnouncementsNotice announcements={site.platform_announcements} />
      <SchemaMarkup
        site={site}
        domain={domain}
        breadcrumb={[{ name: page.title, url: `https://${domain}/${slugStr}` }]}
      />
      <PageRenderer
        websiteId={site.website.id}
        slug={page.slug}
        page={page}
        site={site}
        theme={siteTheme}
        tenantId={site.website.tenant_id}
        companyContact={{
          phone: site.company?.phone || null,
          email: site.company?.email || null,
        }}
      />
    </TemplateLayout>
  );
}
