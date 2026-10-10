#!/usr/bin/env node
/**
 * Generates XML sitemaps for the marketing site + all location pages.
 * Runs AFTER `vite build`, writing into dist/public:
 *   - sitemap.xml            (sitemap index)
 *   - sitemap-core.xml       (main marketing pages + country hubs)
 *   - sitemap-england.xml    (all England town pages)
 *   - sitemap-scotland.xml   (all Scotland town pages)
 *   - sitemap-ireland.xml    (all Republic of Ireland town pages)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist", "public");
const SITE_URL = "https://www.tradeworkdesk.co.uk";

const COUNTRY_SLUGS = ["england", "scotland", "ireland"];

const CORE_PATHS = [
  "/",
  "/features",
  "/tools",
  "/pricing",
  "/find",
  "/blog",
  "/about",
  "/contact",
  "/industries",
  "/alternatives",
  "/gas-engineer-software",
  "/oil-engineer-software",
  "/heat-pump-engineer-software",
  "/plumber-software",
  "/landlord-gas-safety-software",
  "/sole-trader-software",
  "/heating-company-software",
  "/boiler-service-management-software",
  "/job-management-software-heating-engineers",
  "/privacy-policy",
  "/terms-of-service",
];

const locations = JSON.parse(readFileSync(resolve(ROOT, "src", "data", "locations.json"), "utf8"));

function urlset(paths) {
  const urls = paths
    .map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function write(name, content) {
  writeFileSync(resolve(DIST, name), content);
}

function main() {
  // Core: marketing pages + the three country hubs.
  const corePaths = [...CORE_PATHS, ...COUNTRY_SLUGS.map((c) => `/find/${c}`)];
  write("sitemap-core.xml", urlset(corePaths));

  const children = ["sitemap-core.xml"];
  for (const cs of COUNTRY_SLUGS) {
    const paths = locations
      .filter((l) => l.countrySlug === cs)
      .map((l) => `/find/${l.countrySlug}/${l.slug}`);
    write(`sitemap-${cs}.xml`, urlset(paths));
    children.push(`sitemap-${cs}.xml`);
  }

  const index =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    children.map((c) => `  <sitemap><loc>${SITE_URL}/${c}</loc></sitemap>`).join("\n") +
    `\n</sitemapindex>\n`;
  write("sitemap.xml", index);

  const total = corePaths.length + locations.length;
  console.log(`Generated sitemap index + ${children.length} sitemaps (${total} URLs) into ${DIST}`);
}

main();
