#!/usr/bin/env node
/**
 * Generates the "find a tradesperson" town/city dataset used to build the
 * location landing pages (/find/:country/:town), their prerendered HTML and
 * the sitemaps.
 *
 * Source: scripts/towns-source.csv (columns: Town, Country, Source).
 * Run manually to refresh after editing the CSV:
 *   node scripts/generate-location-data.mjs
 * Output (committed): src/data/locations.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV = resolve(__dirname, "towns-source.csv");
const ENRICHMENT = resolve(__dirname, "geo-enrichment.json");
const OUT = resolve(__dirname, "..", "src", "data", "locations.json");

const COUNTRY_SLUGS = {
  Scotland: "scotland",
  England: "england",
  "Republic of Ireland": "ireland",
};

// `indexable` is decided at build time by apply-coverage.mjs based on whether a
// real listing covers the town; the generator just seeds it to false. This keeps
// indexing tied to genuine local value (listings) rather than page count.

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Minimal CSV line splitter supporting quoted fields. */
function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function main() {
  const raw = readFileSync(CSV, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const iTown = header.indexOf("town");
  const iCountry = header.indexOf("country");
  if (iTown < 0 || iCountry < 0) {
    throw new Error(`CSV must have Town and Country columns, got: ${header.join(", ")}`);
  }

  let enrichment = {};
  try {
    enrichment = JSON.parse(readFileSync(ENRICHMENT, "utf8"));
  } catch {
    console.warn(`No geo-enrichment.json found at ${ENRICHMENT}; towns will have no coordinates.`);
  }

  const seen = new Map(); // countrySlug -> Set(slug)
  const out = [];
  let skipped = 0;
  const counts = {};

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const town = (cells[iTown] || "").trim();
    const country = (cells[iCountry] || "").trim();
    const countrySlug = COUNTRY_SLUGS[country];
    if (!town || !countrySlug) {
      skipped++;
      continue;
    }
    const slug = slugify(town);
    if (!slug) {
      skipped++;
      continue;
    }
    if (!seen.has(countrySlug)) seen.set(countrySlug, new Set());
    const slugSet = seen.get(countrySlug);
    if (slugSet.has(slug)) {
      skipped++;
      continue; // duplicate town within the same country
    }
    slugSet.add(slug);

    const geo = enrichment[`${countrySlug}/${slug}`] || null;
    const population = geo?.population ?? null;

    out.push({
      country,
      countrySlug,
      region: geo?.region ?? null,
      town,
      slug,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      population,
      indexable: false,
    });
    counts[country] = (counts[country] || 0) + 1;
  }

  out.sort((a, b) =>
    a.countrySlug === b.countrySlug
      ? a.town.localeCompare(b.town)
      : a.countrySlug.localeCompare(b.countrySlug)
  );

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 0) + "\n");

  for (const [c, n] of Object.entries(counts)) {
    console.log(`${c}: ${n}`);
  }
  console.log(`Total:   ${out.length}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Written: ${OUT}`);
}

main();
