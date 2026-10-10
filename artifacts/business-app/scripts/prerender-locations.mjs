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
 *
 * Content and schema here are kept in sync with src/pages/marketing/location.tsx.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist", "public");
const SITE_URL = "https://www.tradeworkdesk.co.uk";
const SITE_NAME = "TradeWorkDesk";
const LAST_UPDATED = process.env.VITE_BUILD_DATE || new Date().toISOString().slice(0, 10);
const PUBLISHER = { name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` };

const COUNTRY_LABELS = { england: "England", scotland: "Scotland", ireland: "Republic of Ireland" };
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

function haversineMiles(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearby(loc, count = 12) {
  const list = byCountry.get(loc.countrySlug) ?? [];
  if (loc.lat != null && loc.lng != null) {
    return list
      .filter((l) => l.slug !== loc.slug && l.lat != null && l.lng != null)
      .map((l) => ({ ...l, distanceMiles: Math.round(haversineMiles(loc, l)) }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, count);
  }
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

function introVariant(loc, countryLabel, nearest) {
  const town = loc.town, region = loc.region, population = loc.population;
  const where = region ? `${town}, in ${region},` : `${town} in ${countryLabel}`;
  const pop = population ? ` Home to around ${population.toLocaleString()} people,` : "";
  const near = nearest ? ` It also puts you within reach of engineers covering nearby ${nearest}.` : "";
  const variants = [
    `Looking for a reliable heating engineer, boiler specialist, gas engineer or plumber in ${town}?${pop} ${where} is served by tradespeople who manage their jobs, customers and compliance through TradeWorkDesk.${near}`,
    `Need a trusted gas engineer, plumber or heat pump installer in ${town}?${pop} Browse local, verified tradespeople covering ${town} and the surrounding ${region ?? countryLabel} area — every one of them runs their business on TradeWorkDesk.${near}`,
    `Find heating and plumbing professionals serving ${town}.${pop} From annual boiler services and breakdowns to full heat pump and oil installations, the engineers listed here cover ${where.replace(/,$/, "")} and keep their qualifications and records up to date.${near}`,
  ];
  let h = 0;
  for (let i = 0; i < loc.slug.length; i++) h = (h * 31 + loc.slug.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}

function faqItems(loc, countryLabel) {
  const area = loc.region ? `${loc.town}, ${loc.region}` : `${loc.town}, ${countryLabel}`;
  return [
    [`How do I find a heating engineer or plumber in ${loc.town}?`, `Browse the verified tradespeople listed on this page, or search our wider directory. Every business on TradeWorkDesk manages their jobs and compliance through the platform, so you can compare trades, reviews and contact details before getting in touch.`],
    [`Are the tradespeople serving ${area} qualified?`, `Listings show each engineer's trades and any registrations they've added, such as Gas Safe or OFTEC. Always confirm a tradesperson's registration with the relevant body before work begins.`],
    [`I'm a tradesperson in ${loc.town} — how do I get listed?`, `Start a free 30-day trial of TradeWorkDesk. A directory listing for ${loc.town} is included on every plan, helping local customers find you.`],
  ];
}

function head({ title, description, canonical, schema, noindex }) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const tags = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    noindex ? `<meta name="robots" content="noindex,nofollow" />` : "",
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:image" content="${SITE_URL}/opengraph.jpg" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].filter(Boolean);
  for (const s of schema) tags.push(`<script type="application/ld+json">${JSON.stringify(s).replace(/</g, "\\u003c")}</script>`);
  return tags.join("\n    ");
}

function chip(href, label, extra = "") {
  return `<a href="${esc(href)}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:border-primary/40 hover:text-primary transition-colors">${esc(label)}${extra}</a>`;
}

function fact(label, value) {
  return `<div class="rounded-lg border border-slate-200 bg-white p-3"><dt class="text-xs uppercase tracking-wide text-slate-400">${esc(label)}</dt><dd class="text-sm font-semibold text-slate-800 mt-0.5">${esc(value)}</dd></div>`;
}

function townBody(loc) {
  const countryLabel = COUNTRY_LABELS[loc.countrySlug];
  const near = nearby(loc, 12);
  const feat = featured(loc.countrySlug).filter((f) => f.slug !== loc.slug).slice(0, 8);
  const nearest = near[0]?.town ?? null;
  const facts = [
    fact("Country", countryLabel),
    loc.region ? fact("Area", loc.region) : "",
    loc.population != null ? fact("Population", loc.population.toLocaleString()) : "",
    nearest && near[0]?.distanceMiles != null ? fact("Nearest town", `${nearest} (${near[0].distanceMiles} mi)`) : "",
  ].filter(Boolean).join("");
  return `
<nav class="text-sm"><a href="/find">Find a Tradesperson</a> / <a href="/find/${loc.countrySlug}">${esc(countryLabel)}</a> / <span>${esc(loc.town)}</span></nav>
<h1 class="font-display text-4xl font-bold text-slate-900">Find a Heating &amp; Plumbing Engineer in ${esc(loc.town)}</h1>
<p class="text-lg text-slate-600">${esc(introVariant(loc, countryLabel, nearest))}</p>
<div class="flex flex-wrap gap-2">${TRADES.map((t) => `<span class="px-2.5 py-1 rounded-md bg-slate-100 text-sm">${esc(t)}</span>`).join("")}</div>
<dl class="grid grid-cols-2 sm:grid-cols-4 gap-4">${facts}</dl>
<h2 class="text-xl font-bold text-slate-900">Tradespeople near ${esc(loc.town)}</h2>
<section>
  <h2 class="font-semibold text-slate-900">How listings work</h2>
  <p class="text-sm text-slate-600">Every business shown in ${esc(loc.town)} runs its jobs, certificates and customer records on TradeWorkDesk. Listings display the trades and registrations each engineer provides — always confirm a tradesperson's registration before work begins.</p>
  <h2 class="font-semibold text-slate-900">Check their qualifications</h2>
  <p class="text-sm text-slate-600">Gas work must be done by a <a href="https://www.gassaferegister.co.uk/" rel="noopener nofollow">Gas Safe registered</a> engineer; oil heating work should be carried out by an <a href="https://www.oftec.org/" rel="noopener nofollow">OFTEC registered</a> technician. You can verify any registration directly with those bodies.</p>
  <p class="text-xs text-slate-400">Listings updated ${esc(LAST_UPDATED)}.</p>
</section>
<section>
  <h2 class="text-lg font-bold text-slate-900">Towns near ${esc(loc.town)}</h2>
  <div class="flex flex-wrap gap-2">${near.map((n) => chip(`/find/${n.countrySlug}/${n.slug}`, n.town, n.distanceMiles != null ? ` · ${n.distanceMiles} mi` : "")).join("")}</div>
  <p><a href="/find/${loc.countrySlug}">See all towns in ${esc(countryLabel)}</a></p>
  ${feat.length ? `<h2 class="text-lg font-bold text-slate-900">Popular areas in ${esc(countryLabel)}</h2><div class="flex flex-wrap gap-2">${feat.map((f) => chip(`/find/${f.countrySlug}/${f.slug}`, f.town)).join("")}</div>` : ""}
</section>
<section>
  <h2 class="text-xl font-bold text-slate-900">Finding a tradesperson in ${esc(loc.town)}</h2>
  ${faqItems(loc, countryLabel).map(([q, a]) => `<h3 class="font-semibold text-slate-900">${esc(q)}</h3><p class="text-slate-600">${esc(a)}</p>`).join("")}
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
  const title = `Find a Heating & Plumbing Engineer in ${loc.town} | ${SITE_NAME}`;
  const org = { "@type": "Organization", name: PUBLISHER.name, url: PUBLISHER.url, logo: { "@type": "ImageObject", url: PUBLISHER.logo } };
  const webPage = {
    "@context": "https://schema.org", "@type": "WebPage", name: title, url: canonical,
    dateModified: LAST_UPDATED, isPartOf: { "@type": "WebSite", name: PUBLISHER.name, url: PUBLISHER.url }, publisher: org,
  };
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find a Tradesperson", item: `${SITE_URL}/find` },
      { "@type": "ListItem", position: 2, name: countryLabel, item: `${SITE_URL}/find/${loc.countrySlug}` },
      { "@type": "ListItem", position: 3, name: loc.town, item: canonical },
    ],
  };
  const service = {
    "@context": "https://schema.org", "@type": "Service", name: `Heating & plumbing engineers in ${loc.town}`,
    serviceType: "Heating, gas and plumbing engineers", provider: org, url: canonical,
    areaServed: loc.lat != null && loc.lng != null
      ? { "@type": "GeoCircle", geoMidpoint: { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng }, geoRadius: 25000 }
      : { "@type": "City", name: loc.town },
  };
  const faq = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqItems(loc, countryLabel).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return [webPage, breadcrumb, service, faq];
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
  const org = { "@type": "Organization", name: PUBLISHER.name, url: PUBLISHER.url, logo: { "@type": "ImageObject", url: PUBLISHER.logo } };
  return [
    { "@context": "https://schema.org", "@type": "WebPage", name: `Find a Heating & Plumbing Engineer in ${countryLabel} | ${SITE_NAME}`, url: canonical, dateModified: LAST_UPDATED, isPartOf: { "@type": "WebSite", name: PUBLISHER.name, url: PUBLISHER.url }, publisher: org },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Find a Tradesperson", item: `${SITE_URL}/find` },
        { "@type": "ListItem", position: 2, name: countryLabel, item: canonical },
      ],
    },
  ];
}

function main() {
  const indexPath = resolve(DIST, "index.html");
  let template = readFileSync(indexPath, "utf8");
  template = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    // Drop the SPA's modulepreload hints on these content-first marketing pages.
    // They eagerly fetch large chunks (e.g. charts) the location page never uses,
    // starving the CSS/first paint on slow connections. The chunks still load on
    // demand when the app boots; dropping the hints improves LCP/FCP.
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, "");

  function render(pathname, headHtml, bodyHtml) {
    let html = template.replace("</head>", `    ${headHtml}\n  </head>`);
    html = html.replace('<div id="root"></div>', `<div id="root"><div class="twd-prerender max-w-4xl mx-auto px-4 py-10 space-y-6">${bodyHtml}</div></div>`);
    const outDir = resolve(DIST, pathname.replace(/^\//, ""));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), html);
  }

  let count = 0;
  for (const cs of COUNTRY_SLUGS) {
    const label = COUNTRY_LABELS[cs];
    const total = (byCountry.get(cs) ?? []).length;
    render(`/find/${cs}`, head({
      title: `Find a Heating & Plumbing Engineer in ${label}`,
      description: `Browse ${total} towns and cities across ${label} to find local, verified heating engineers, gas engineers, boiler specialists and plumbers on TradeWorkDesk.`,
      canonical: `${SITE_URL}/find/${cs}`, schema: hubSchema(cs), noindex: false,
    }), hubBody(cs));
    count++;
  }

  for (const loc of locations) {
    const countryLabel = COUNTRY_LABELS[loc.countrySlug];
    const areaLabel = loc.region ? `${loc.town}, ${loc.region}` : `${loc.town}, ${countryLabel}`;
    render(`/find/${loc.countrySlug}/${loc.slug}`, head({
      title: `Find a Heating & Plumbing Engineer in ${loc.town}`,
      description: `Find local, verified heating engineers, gas engineers, boiler specialists and plumbers in ${areaLabel}. Compare trades, reviews and contact details on TradeWorkDesk.`,
      canonical: `${SITE_URL}/find/${loc.countrySlug}/${loc.slug}`,
      schema: townSchema(loc),
      noindex: !loc.indexable,
    }), townBody(loc));
    count++;
  }

  const indexable = locations.filter((l) => l.indexable).length;
  console.log(`Prerendered ${count} location pages into ${DIST} (${indexable} towns indexable, ${locations.length - indexable} noindex)`);
}

main();
