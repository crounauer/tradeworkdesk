#!/usr/bin/env node
/**
 * Builds scripts/geo-enrichment.json — the coordinates / county / population
 * data merged into the location dataset by generate-location-data.mjs.
 *
 * Source: GeoNames open data (CC BY 4.0) — the GB and IE place dumps plus the
 * admin code name tables. This script downloads them to a temp dir and matches
 * each town in src/data/locations.json by slug (within the correct region),
 * preferring the highest-population candidate and falling back to alternate
 * names so renamed/hyphenated towns (e.g. "Abingdon-on-Thames") still match.
 *
 * Run manually to refresh after the town list changes:
 *   node scripts/build-geo-enrichment.mjs
 *
 * Requires `curl` and `unzip` on PATH.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCATIONS = resolve(__dirname, "..", "src", "data", "locations.json");
const OUT = resolve(__dirname, "geo-enrichment.json");
const dir = process.env.GEONAMES_DIR || mkdtempSync(join(tmpdir(), "geonames-"));
function ensure(file, url) {
  const path = join(dir, file);
  if (existsSync(path)) return path;
  console.log(`Downloading ${url}`);
  execSync(`curl -sSL -o "${path}" "${url}"`, { stdio: "inherit" });
  if (file.endsWith(".zip")) execSync(`unzip -o "${path}" -d "${dir}"`, { stdio: "ignore" });
  return path;
}

ensure("GB.zip", "https://download.geonames.org/export/dump/GB.zip");
ensure("IE.zip", "https://download.geonames.org/export/dump/IE.zip");
ensure("admin2Codes.txt", "https://download.geonames.org/export/dump/admin2Codes.txt");
ensure("admin1CodesASCII.txt", "https://download.geonames.org/export/dump/admin1CodesASCII.txt");

function slugify(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const admin2 = new Map();
for (const line of readFileSync(join(dir, "admin2Codes.txt"), "utf8").split("\n")) {
  const [code, name] = line.split("\t");
  if (code) admin2.set(code, name);
}
const admin1 = new Map();
for (const line of readFileSync(join(dir, "admin1CodesASCII.txt"), "utf8").split("\n")) {
  const [code, name] = line.split("\t");
  if (code) admin1.set(code, name);
}

function buildIndex(file) {
  const idx = new Map(); // bucket -> { primary, secondary }
  const bucketOf = (m) => {
    if (!idx.has(m)) idx.set(m, { primary: new Map(), secondary: new Map() });
    return idx.get(m);
  };
  const put = (map, s, rec) => {
    if (!s) return;
    const prev = map.get(s);
    if (!prev || rec.pop > prev.pop) map.set(s, rec);
  };
  for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
    const c = line.split("\t");
    if (c.length < 15 || c[6] !== "P") continue;
    const country = c[8], a1 = c[10], a2 = c[11];
    const pop = parseInt(c[14] || "0", 10) || 0;
    const lat = parseFloat(c[4]), lng = parseFloat(c[5]);
    let bucket, region = null;
    if (country === "GB") {
      if (a1 !== "ENG" && a1 !== "SCT") continue;
      bucket = a1;
      region = admin2.get(`GB.${a1}.${a2}`) || null;
    } else if (country === "IE") {
      bucket = "IE";
      region = (admin1.get(`IE.${a1}`) || null);
      if (region) region = region.replace(/^County\s+/i, "");
    } else continue;
    const rec = { lat, lng, pop, region };
    const b = bucketOf(bucket);
    for (const nm of [c[1], c[2]]) put(b.primary, slugify(nm || ""), rec);
    for (const alt of (c[3] || "").split(",")) put(b.secondary, slugify(alt), rec);
  }
  return idx;
}

const gb = buildIndex("GB.txt");
const ie = buildIndex("IE.txt");
const buckets = { england: gb.get("ENG"), scotland: gb.get("SCT"), ireland: ie.get("IE") };
const lookup = (bucket, slug) =>
  bucket ? (bucket.primary.get(slug) || bucket.secondary.get(slug) || null) : null;

const locations = JSON.parse(readFileSync(LOCATIONS, "utf8"));
const enrichment = {};
const perCountry = {};
let matched = 0;
for (const loc of locations) {
  const rec = lookup(buckets[loc.countrySlug], loc.slug);
  perCountry[loc.countrySlug] = perCountry[loc.countrySlug] || { total: 0, matched: 0 };
  perCountry[loc.countrySlug].total++;
  if (rec && Number.isFinite(rec.lat) && Number.isFinite(rec.lng)) {
    enrichment[`${loc.countrySlug}/${loc.slug}`] = {
      lat: Math.round(rec.lat * 10000) / 10000,
      lng: Math.round(rec.lng * 10000) / 10000,
      population: rec.pop || 0,
      region: rec.region,
    };
    matched++;
    perCountry[loc.countrySlug].matched++;
  }
}

writeFileSync(OUT, JSON.stringify(enrichment, null, 0) + "\n");
console.log(`matched ${matched} / ${locations.length}`);
for (const [k, v] of Object.entries(perCountry)) console.log(` ${k}: ${v.matched}/${v.total}`);
console.log(`Written: ${OUT}`);
