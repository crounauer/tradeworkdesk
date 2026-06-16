import { headers } from "next/headers";
import { getSiteByDomain } from "@/lib/api";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const domain = (await headers()).get("x-tenant-domain") || "localhost";
  const site = await getSiteByDomain(domain);

  if (!site) return [];

  const base = `https://${domain}`;

  const pageEntries: MetadataRoute.Sitemap = site.pages.map((page) => ({
    url: `${base}/${page.slug}`.replace(/\/\/$/, "/").replace("//", "/"),
    lastModified: page.published_at ? new Date(page.published_at) : undefined,
    changeFrequency: page.page_type === "home" ? "weekly" : "monthly",
    priority: page.page_type === "home" ? 1.0 : 0.7,
  }));

  const blogEntries: MetadataRoute.Sitemap = site.blog_posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.published_at ? new Date(post.published_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...pageEntries, ...blogEntries];
}
