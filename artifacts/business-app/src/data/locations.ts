import rawLocations from "./locations.json";

export interface Location {
  country: string;
  countrySlug: string;
  region: string | null;
  town: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  population: number | null;
  indexable: boolean;
}

export const locations = rawLocations as Location[];

export const COUNTRY_LABELS: Record<string, string> = {
  england: "England",
  scotland: "Scotland",
  ireland: "Republic of Ireland",
};

export const COUNTRY_SLUGS = Object.keys(COUNTRY_LABELS);

/** Publisher identity used for Organization / author E-E-A-T signals. */
export const SITE_URL = "https://www.tradeworkdesk.co.uk";
export const PUBLISHER = {
  name: "TradeWorkDesk",
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
};

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

export function getFeaturedLocations(countrySlug: string): Location[] {
  return (FEATURED_SLUGS[countrySlug] ?? [])
    .map((slug) => byKey.get(`${countrySlug}/${slug}`))
    .filter((l): l is Location => Boolean(l));
}

function haversineMiles(a: Location, b: Location): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad((b.lat as number) - (a.lat as number));
  const dLon = toRad((b.lng as number) - (a.lng as number));
  const lat1 = toRad(a.lat as number);
  const lat2 = toRad(b.lat as number);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Nearest towns by real distance (when coordinates are available), which makes
 * the internal links genuinely relevant and unique per page. Falls back to
 * alphabetical neighbours when the current town has no coordinates.
 */
export function getNearbyLocations(loc: Location, count = 12): Array<Location & { distanceMiles?: number }> {
  const list = getCountryLocations(loc.countrySlug);
  if (loc.lat != null && loc.lng != null) {
    return list
      .filter((l) => l.slug !== loc.slug && l.lat != null && l.lng != null)
      .map((l) => ({ ...l, distanceMiles: Math.round(haversineMiles(loc, l)) }))
      .sort((a, b) => a.distanceMiles! - b.distanceMiles!)
      .slice(0, count);
  }
  const idx = list.findIndex((l) => l.slug === loc.slug);
  if (idx === -1) return list.slice(0, count);
  const half = Math.floor(count / 2);
  const end = Math.min(list.length, Math.max(0, idx - half) + count + 1);
  const start = Math.max(0, end - count - 1);
  return list.slice(start, end).filter((l) => l.slug !== loc.slug);
}
