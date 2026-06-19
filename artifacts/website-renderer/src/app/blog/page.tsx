import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain, getPageBySlug } from "@/lib/api";
import TemplateLayout from "@/components/layout/TemplateLayout";
import BlogList from "@/components/blog/BlogList";
import WebsiteClosureNotice from "@/components/WebsiteClosureNotice";
import PlatformAnnouncementsNotice from "@/components/PlatformAnnouncementsNotice";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);
  if (!site) return {};

  return {
    title: `Blog | ${site.website.site_name}`,
    description: site.website.default_meta_description || undefined,
  };
}

export default async function BlogIndexPage() {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);
  if (!site) notFound();

  return (
    <TemplateLayout site={site}>
      <WebsiteClosureNotice company={site.company} />
      <PlatformAnnouncementsNotice announcements={site.platform_announcements} />
      <BlogList posts={site.blog_posts} siteName={site.website.site_name} />
    </TemplateLayout>
  );
}
