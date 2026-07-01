import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import { getRequestDomain } from "@/lib/request-domain";
import { buildBlogDescription } from "@/lib/seo";
import TemplateLayout from "@/components/layout/TemplateLayout";
import BlogList from "@/components/blog/BlogList";
import WebsiteClosureNotice from "@/components/WebsiteClosureNotice";
import PlatformAnnouncementsNotice from "@/components/PlatformAnnouncementsNotice";

export const revalidate = 5;

export async function generateMetadata(): Promise<Metadata> {
  const domain = await getRequestDomain();
  const site = await getSiteByDomain(domain);
  if (!site) return {};

  return {
    title: `Blog | ${site.website.site_name}`,
    description: buildBlogDescription(site),
  };
}

export default async function BlogIndexPage() {
  const domain = await getRequestDomain();
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
