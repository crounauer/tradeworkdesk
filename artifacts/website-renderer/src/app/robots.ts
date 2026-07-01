import { getSiteByDomain } from "@/lib/api";
import { getRequestDomain } from "@/lib/request-domain";
import type { MetadataRoute } from "next";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const domain = await getRequestDomain();
  const site = await getSiteByDomain(domain);

  if (!site || site.website.status !== "published") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `https://${domain}/sitemap.xml`,
  };
}
