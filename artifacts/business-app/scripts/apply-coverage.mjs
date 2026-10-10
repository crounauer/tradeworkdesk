#!/usr/bin/env node
/**
 * Decides which location pages may be indexed, based on REAL listing coverage.
 *
 * Runs at the start of the build (before vite build). It fetches the live public
 * directory, then marks a town `indexable: true` only when at least one listed
 * tradesperson is within COVERAGE_RADIUS_MILES of it. Towns with no genuine
 * local value stay `indexable: false` (built, crawlable, but noindex and absent
 * from the sitemap). This keeps us compliant with the "index only where real
 * local content exists / no doorway pages" rule.
 *
 * Fails safe: if the directory can't be reached, nothing is promoted (all towns
 * remain noindex) rather than publishing empty pages.
 *
 * Env:
 *   DIRECTORY_API_URL   base API url (default https://tradeworkdesk-api.fly.dev)
 *   COVERAGE_RADIUS_MILES  default 25
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCATIONS = resolve(__dirname, "..", "src", "data", "locations.json");
const API = (process.env.DIRECTORY_API_URL || "https://tradeworkdesk-api.fly.dev").replace(/\/$/, "");
const RADIUS = Number(process.env.COVERAGE_RADIUS_MILES || "25");

function haversineMiles(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(aLat)) * Math.cos(toRad(bLat));
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function main() {
  const locations = JSON.parse(readFileSync(LOCATIONS, "utf8"));

  let listings = [];
  try {
    const res = await fetch(`${API}/api/directory`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    listings = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn(`apply-coverage: could not fetch directory (${err.message}); leaving all towns noindex.`);
  }

  const points = listings
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({ lat: Number(l.latitude), lng: Number(l.longitude) }));

  let indexable = 0;
  for (const loc of locations) {
    let covered = false;
    if (loc.lat != null && loc.lng != null) {
      for (const p of points) {
        if (haversineMiles(loc.lat, loc.lng, p.lat, p.lng) <= RADIUS) { covered = true; break; }
      }
    }
    loc.indexable = covered;
    if (covered) indexable++;
  }

  writeFileSync(LOCATIONS, JSON.stringify(locations, null, 0) + "\n");
  console.log(`apply-coverage: ${listings.length} listings, ${points.length} geocoded; ${indexable}/${locations.length} towns indexable (radius ${RADIUS}mi).`);
}

main().catch((err) => {
  // Never fail the build on coverage issues.
  console.warn(`apply-coverage: ${err.message}; leaving dataset unchanged.`);
});
