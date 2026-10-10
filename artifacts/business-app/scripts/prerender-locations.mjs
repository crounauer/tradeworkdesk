#!/usr/bin/env node
/**
 * Build-time prerender for the "find a tradesperson" location pages.
 *
 * Runs AFTER `vite build`. For every country hub (/find/:country) and town
 * (/find/:country/:town) it writes a static index.html into dist/public that
 * contains full SEO <head> tags, JSON-LD and real, crawlable body content, then
 * boots the normal SPA which hydrates and takes over. Static files are served
 * by Vercel in preference to the SPA rewrite, so crawlers get HTML without
 * needing to execute JavaScript.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist", "public");
const SITE_URL = "https://www.tradeworkdesk.co.uk";
const SITE_NAME = "TradeWorkDesk";

const COUNTRY_LABELS = {
  england: "England",
  scotland: "Scotland",
  ireland: "Republic of Ireland",
};
const COUNTRY_SLUGS = Object.keys(COUNTRY_LABELS);
const FEATURED_SLUGS = {
  england: ["london", "manchester", "birmingham", "leeds", "liverpool", "bristol", "sheffield", "newcastle-upon-tyne", "nottingham", "leicester", "coventry", "sunderland"],
  scotland: ["glasgow", "edinburgh", "aberdeen", "dundee", "inverness", "perth", "stirling", "paisley"],
  ireland: ["dublin", "cork", "limerick", "galway", "waterford", "drogheda", "dundalk", "swords"],
};
const TRADES = ["Gas Engineers", "Boiler Service & Repair", "Heat Pump Engineers", "Oil & OFTEC Engineers", "Plumbers", "Landlord Gas Safety"];

const locations = JSON.parse(readFileSync(resolve(ROOT, "src", "data", "locations.json"), "utf8"));
const byCountry = new Map();
const byKey = new Map();
for (const l of locations) {
  if (!byCountry.has(l.countrySlug)) byCountry.set(l.countrySlug, []);
  byCountry.get(l.countrySlug).push(l);
  byKey.set(`${l.countrySlug}/${l.slug}`, l);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nearby(loc, count = 12) {
  const list = byCountry.get(loc.countrySlug) ?? [];
  const idx = list.findIndex((l) => l.slug === loc.slug);
  if (idx === -1) return list.slice(0, count);
  const half = Math.floor(count / 2);
  const end = Math.min(list.length, Math.max(0, idx - half) + count + 1);
  const start = Math.max(0, end - count - 1);
  return list.slice(start, end).filter((l) => l.slug !== loc.slug);
}

function featured(countrySlug) {
  return (FEATURED_SLUGS[countrySlug] ?? []).map((s) => byKey.get(`${countrySlug}/${s}`)).filter(Boolean);
}

/** Build the <head> SEO block (title/meta/canonical/og/twitter + JSON-LD). */
function head({ title, description, canonical, schema }) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const tags = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:image" content="${SITE_URL}/opengraph.jpg" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  for (const s of schema) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(s).replace(/</g, "\\u003c")}</script>`);
  }
  return tags.join("\n    ");
}

function chip(href, label) {
  return `<a href="${esc(href)}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:border-primary/40 hover:text-primary transition-colors">${esc(label)}</a>`;
}

function townBody(loc) {
  const countryLabel = COUNTRY_LABELS[loc.countrySlug];
  const near = nearby(loc, 12);
  const feat = featured(loc.countrySlug).filter((f) => f.slug !== loc.slug).slice(0, 8);
  const faq = [
    [`How do I find a heating engineer or plumber in ${loc.town}?`, `Browse the verified tradespeople listed on this page, or search our wider directory. Every business on TradeWorkDesk manages their jobs and compliance through the platform, so you can see their trades, contact details and reviews before getting in touch.`],
    [`Are the tradespeople serving ${loc.town} qualified?`, `Listings show each engineer's trades and any registrations they've added, such as Gas Safe or OFTEC. Always confirm a tradesperson's registration before work begins.`],
    [`I'm a tradesperson in ${loc.town} — how do I get listed?`, `Start a free 30-day trial of TradeWorkDesk. A directory listing for ${loc.town} is included on every plan, helping local customers find you.`],
  ];
  return `
<nav class="text-sm"><a href="/find">Find a Tradesperson</a> / <a href="/find/${loc.countrySlug}">${esc(countryLabel)}</a> / <span>${esc(loc.town)}</span></nav>
<h1 class="font-display text-4xl font-bold text-slate-900">Find a Heating &amp; Plumbing Engineer in ${esc(loc.town)}</h1>
<p class="text-lg text-slate-600">Looking for a reliable heating engineer, boiler specialist, gas engineer or plumber in ${esc(loc.town)}, ${esc(countryLabel)}? Browse verified local tradespeople — all using TradeWorkDesk to manage their jobs, customers and compliance.</p>
<div class="flex flex-wrap gap-2">${TRADES.map((t) => `<span class="px-2.5 py-1 rounded-md bg-slate-100 text-sm">${esc(t)}</span>`).join("")}</div>
<h2 class="text-xl font-bold text-slate-900">Tradespeople near ${esc(loc.town)}</h2>
<section>
  <h2 class="text-lg font-bold text-slate-900">Other towns in ${esc(countryLabel)}</h2>
  <div class="flex flex-wrap gap-2">${near.map((n) => chip(`/find/${n.countrySlug}/${n.slug}`, n.town)).join("")}</div>
  <p><a href="/find/${loc.countrySlug}">See all towns in ${esc(countryLabel)}</a></p>
  ${feat.length ? `<h2 class="text-lg font-bold text-slate-900">Popular areas in ${esc(countryLabel)}</h2><div class="flex flex-wrap gap-2">${feat.map((f) => chip(`/find/${f.countrySlug}/${f.slug}`, f.town)).join("")}</div>` : ""}
</section>
<section>
  <h2 class="text-xl font-bold text-slate-900">Finding a tradesperson in ${esc(loc.town)}</h2>
  ${faq.map(([q, a]) => `<h3 class="font-semibold text-slate-900">${esc(q)}</h3><p class="text-slate-600">${esc(a)}</p>`).join("")}
</section>
<section>
  <h2 class="text-xl font-bold text-slate-900">Are you a heating engineer or plumber in ${esc(loc.town)}?</h2>
  <p class="text-slate-600">Get your business listed in our ${esc(loc.town)} directory — free with any TradeWorkDesk plan.</p>
  <a href="/register">Start 30-Day Free Trial</a> <a href="/find">Browse the directory</a>
</section>`;
}

function townSchema(loc) {
  const countryLabel = COUNTRY_LABELS[loc.countrySlug];
  const canonical = `${SITE_URL}/find/${loc.countrySlug}/${loc.slug}`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find a Tradesperson", item: `${SITE_URL}/find` },
      { "@type": "ListItem", position: 2, name: countryLabel, item: `${SITE_URL}/find/${loc.countrySlug}` },
      { "@type": "ListItem", position: 3, name: loc.town, item: canonical },
    ],
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      [`How do I find a heating engineer or plumber in ${loc.town}?`, `Browse the verified tradespeople listed on this page, or search our wider directory on TradeWorkDesk.`],
      [`Are the tradespeople serving ${loc.town} qualified?`, `Listings show each engineer's trades and registrations such as Gas Safe or OFTEC. Always confirm registration before work begins.`],
      [`I'm a tradesperson in ${loc.town} — how do I get listed?`, `Start a free 30-day trial of TradeWorkDesk; a ${loc.town} directory listing is included on every plan.`],
    ].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return [breadcrumb, faq];
}

function hubBody(countrySlug) {
  const countryLabel = COUNTRY_LABELS[countrySlug];
  const towns = byCountry.get(countrySlug) ?? [];
  const links = towns.map((t) => chip(`/find/${t.countrySlug}/${t.slug}`, t.town)).join("");
  return `
<nav class="text-sm"><a href="/find">Find a Tradesperson</a> / <span>${esc(countryLabel)}</span></nav>
<h1 class="font-display text-4xl font-bold text-slate-900">Find a Tradesperson in ${esc(countryLabel)}</h1>
<p class="text-lg text-slate-600">Choose a town or city to find local, verified heating engineers, boiler specialists, gas engineers and plumbers across ${esc(countryLabel)}.</p>
<div class="flex flex-wrap gap-2">${links}</div>`;
}

function hubSchema(countrySlug) {
  const countryLabel = COUNTRY_LABELS[countrySlug];
  const canonical = `${SITE_URL}/find/${countrySlug}`;
  return [{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find a Tradesperson", item: `${SITE_URL}/find` },
      { "@type": "ListItem", position: 2, name: countryLabel, item: canonical },
    ],
  }];
}

function main() {
  const indexPath = resolve(DIST, "index.html");
  let template = readFileSync(indexPath, "utf8");
  // Remove the base <title> and description so page-specific ones are canonical.
  template = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "");

  function render(pathname, headHtml, bodyHtml) {
    let html = template.replace("</head>", `    ${headHtml}\n  </head>`);
    html = html.replace('<div id="root"></div>', `<div id="root"><div class="twd-prerender max-w-4xl mx-auto px-4 py-10 space-y-6">${bodyHtml}</div></div>`);
    const outDir = resolve(DIST, pathname.replace(/^\//, ""));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), html);
  }

  let count = 0;
  for (const cs of COUNTRY_SLUGS) {
    const canonical = `${SITE_URL}/find/${cs}`;
    const label = COUNTRY_LABELS[cs];
    const total = (byCountry.get(cs) ?? []).length;
    render(
      `/find/${cs}`,
      head({
        title: `Find a Heating & Plumbing Engineer in ${label}`,
        description: `Browse ${total} towns and cities across ${label} to find local, verified heating engineers, gas engineers, boiler specialists and plumbers on TradeWorkDesk.`,
        canonical,
        schema: hubSchema(cs),
      }),
      hubBody(cs)
    );
    count++;
  }

  for (const loc of locations) {
    const countryLabel = COUNTRY_LABELS[loc.countrySlug];
    render(
      `/find/${loc.countrySlug}/${loc.slug}`,
      head({
        title: `Find a Heating & Plumbing Engineer in ${loc.town}`,
        description: `Find local, verified heating engineers, boiler specialists, gas engineers and plumbers in ${loc.town}, ${countryLabel}. Browse trusted tradespeople near you on TradeWorkDesk.`,
        canonical: `${SITE_URL}/find/${loc.countrySlug}/${loc.slug}`,
        schema: townSchema(loc),
      }),
      townBody(loc)
    );
    count++;
  }

  console.log(`Prerendered ${count} location pages into ${DIST}`);
}

main();
