import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import TemplateLayout from "@/components/layout/TemplateLayout";
import BlogPostContent from "@/components/blog/BlogPostContent";
import WebsiteClosureNotice from "@/components/WebsiteClosureNotice";
import PlatformAnnouncementsNotice from "@/components/PlatformAnnouncementsNotice";

export const revalidate = 60;

interface BlogPostProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const { slug } = await params;
  const site = await getSiteByDomain(domain);
  if (!site) return {};

  const post = site.blog_posts.find((p) => p.slug === slug);
  if (!post) return {};

  const canonicalUrl = `https://${domain}/blog/${slug}`;
  const title = post.meta_title || `${post.title} | ${site.website.site_name}`;
  const description = post.meta_description || post.excerpt || undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: post.meta_title || post.title,
      description,
      url: canonicalUrl,
      siteName: site.website.site_name,
      images: post.featured_image_url ? [post.featured_image_url] : [],
      type: "article",
      publishedTime: post.published_at || undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const { slug } = await params;
  const site = await getSiteByDomain(domain);
  if (!site) notFound();

  const post = site.blog_posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const siteUrl = `https://${domain}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${siteUrl}/blog/${post.slug}`,
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.featured_image_url ? { image: post.featured_image_url } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    url: `${siteUrl}/blog/${post.slug}`,
    publisher: { "@id": `${siteUrl}/#business` },
  };

  return (
    <TemplateLayout site={site}>
      <WebsiteClosureNotice company={site.company} />
      <PlatformAnnouncementsNotice announcements={site.platform_announcements} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <BlogPostContent post={post} />
    </TemplateLayout>
  );
}
