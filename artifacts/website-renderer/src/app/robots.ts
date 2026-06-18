import { headers } from "next/headers";
import { getSiteByDomain } from "@/lib/api";
import type { MetadataRoute } from "next";

const API_BASE = process.env.API_BASE_URL || "https://api.tradeworkdesk.co.uk";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const domain =
    h.get("x-tenant-domain") ||
    (h.get("host") || "localhost").replace(/:\d+$/, "");
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
