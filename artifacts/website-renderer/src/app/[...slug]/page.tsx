import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import TemplateLayout from "@/components/layout/TemplateLayout";
import PageRenderer from "@/components/PageRenderer";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const { slug } = await params;
  const slugStr = slug.join("/");

  const site = await getSiteByDomain(domain);
  if (!site) return {};

  const page = site.pages.find((p) => p.slug === slugStr || p.slug === `/${slugStr}`);
  if (!page) return {};

  const title = page.meta_title || `${page.title} | ${site.website.site_name}`;
  const description = page.meta_description || site.website.default_meta_description || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: page.og_image_url ? [page.og_image_url] : [],
    },
    robots: page.no_index ? { index: false } : undefined,
    alternates: page.canonical_url ? { canonical: page.canonical_url } : undefined,
  };
}

export default async function DynamicPage({ params }: PageProps) {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const { slug } = await params;
  const slugStr = slug.join("/");

  const site = await getSiteByDomain(domain);
  if (!site) notFound();

  const page = site.pages.find((p) => p.slug === slugStr || p.slug === `/${slugStr}`);
  if (!page) notFound();

  return (
    <TemplateLayout site={site}>
      <PageRenderer
        websiteId={site.website.id}
        slug={page.slug}
        page={page}
      />
    </TemplateLayout>
  );
}
