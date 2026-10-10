import rawLocations from "./locations.json";

export interface Location {
  country: string;
  countrySlug: string;
  region: string | null;
  town: string;
  slug: string;
}

export const locations = rawLocations as Location[];

export const COUNTRY_LABELS: Record<string, string> = {
  england: "England",
  scotland: "Scotland",
  ireland: "Republic of Ireland",
};

export const COUNTRY_SLUGS = Object.keys(COUNTRY_LABELS);

/**
 * Curated "anchor" towns/cities per country. These are the highest-intent
 * locations and act as hubs in the internal link graph: the directory, the
 * footer and every town page link to them, and they link back out, keeping
 * crawl depth shallow and spreading link equity across the section.
 */
const FEATURED_SLUGS: Record<string, string[]> = {
  england: [
    "london", "manchester", "birmingham", "leeds", "liverpool", "bristol",
    "sheffield", "newcastle-upon-tyne", "nottingham", "leicester", "coventry", "sunderland",
  ],
  scotland: [
    "glasgow", "edinburgh", "aberdeen", "dundee", "inverness", "perth", "stirling", "paisley",
  ],
  ireland: [
    "dublin", "cork", "limerick", "galway", "waterford", "drogheda", "dundalk", "swords",
  ],
};

const byCountry = new Map<string, Location[]>();
const byKey = new Map<string, Location>();

for (const loc of locations) {
  if (!byCountry.has(loc.countrySlug)) byCountry.set(loc.countrySlug, []);
  byCountry.get(loc.countrySlug)!.push(loc);
  byKey.set(`${loc.countrySlug}/${loc.slug}`, loc);
}

export function getLocation(countrySlug: string, slug: string): Location | undefined {
  return byKey.get(`${countrySlug}/${slug}`);
}

export function getCountryLocations(countrySlug: string): Location[] {
  return byCountry.get(countrySlug) ?? [];
}

/** Returns the curated anchor towns/cities for a country (used as link hubs). */
export function getFeaturedLocations(countrySlug: string): Location[] {
  return (FEATURED_SLUGS[countrySlug] ?? [])
    .map((slug) => byKey.get(`${countrySlug}/${slug}`))
    .filter((l): l is Location => Boolean(l));
}

/**
 * Returns a stable set of other towns in the same country for internal linking.
 * Without coordinates we can't do true geographic proximity, so we take the
 * alphabetical neighbours around the current town (which keeps links relevant
 * and deterministic across builds).
 */
export function getNearbyLocations(loc: Location, count = 12): Location[] {
  const list = getCountryLocations(loc.countrySlug);
  const idx = list.findIndex((l) => l.slug === loc.slug);
  if (idx === -1) return list.slice(0, count);
  const half = Math.floor(count / 2);
  let start = Math.max(0, idx - half);
  const end = Math.min(list.length, start + count + 1);
  start = Math.max(0, end - count - 1);
  return list.slice(start, end).filter((l) => l.slug !== loc.slug);
}
