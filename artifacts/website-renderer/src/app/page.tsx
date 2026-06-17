import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import TemplateLayout from "@/components/layout/TemplateLayout";
import PageRenderer from "@/components/PageRenderer";

// ISR — re-validate every 60 seconds
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);
  if (!site) return {};

  const { website, company } = site;
  const title = website.default_meta_title || website.site_name;
  const description = website.default_meta_description || website.tagline || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    icons: website.favicon_url ? { icon: website.favicon_url } : undefined,
  };
}

export default async function HomePage() {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);

  if (!site) notFound();

  const homePage = site.pages.find((p) => p.page_type === "home" || p.slug === "/") || site.pages[0];
  if (!homePage) notFound();

  return (
    <TemplateLayout site={site}>
      <PageRenderer
        websiteId={site.website.id}
        slug={homePage.slug}
        page={homePage}
      />
    </TemplateLayout>
  );
}
