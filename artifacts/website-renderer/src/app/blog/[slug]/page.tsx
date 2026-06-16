import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteByDomain } from "@/lib/api";
import SiteLayout from "@/components/layout/SiteLayout";
import BlogPostContent from "@/components/blog/BlogPostContent";

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

  return {
    title: post.meta_title || `${post.title} | ${site.website.site_name}`,
    description: post.meta_description || post.excerpt || undefined,
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || undefined,
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

  return (
    <SiteLayout site={site}>
      <BlogPostContent post={post} />
    </SiteLayout>
  );
}
