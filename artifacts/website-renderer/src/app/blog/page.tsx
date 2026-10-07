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

  const blogPage = site.pages.find(
    (p) => p.page_type === "blog" || p.slug === "blog" || p.slug === "/blog"
  );

  const title = blogPage?.meta_title || `Blog | ${site.website.site_name}`;
  const description = blogPage?.meta_description || buildBlogDescription(site);
  const canonicalUrl = blogPage?.canonical_url || `https://${domain}/blog`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: site.website.site_name,
      images: blogPage?.og_image_url ? [blogPage.og_image_url] : [],
    },
    robots: blogPage?.no_index ? { index: false } : undefined,
  };
}

export default async function BlogIndexPage() {
  const domain = await getRequestDomain();
  const site = await getSiteByDomain(domain);
  if (!site) notFound();

  const siteUrl = `https://${domain}`;
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/blog#collection`,
    url: `${siteUrl}/blog`,
    name: `Blog | ${site.website.site_name}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: site.blog_posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <TemplateLayout site={site}>
      <WebsiteClosureNotice company={site.company} />
      <PlatformAnnouncementsNotice announcements={site.platform_announcements} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <BlogList posts={site.blog_posts} siteName={site.website.site_name} />
    </TemplateLayout>
  );
}
