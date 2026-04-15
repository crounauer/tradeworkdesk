import { supabaseAdmin } from "./supabase";

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function extractPostcode(address: string): string | null {
  const match = address.match(UK_POSTCODE_RE);
  return match ? match[1].trim() : null;
}

export interface GeoResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

export async function getIdealPostcodesKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "ideal_postcodes_api_key")
    .maybeSingle();
  return data?.value || null;
}

export interface IdealPostcodesAddress {
  line_1: string;
  line_2: string;
  line_3: string;
  post_town: string;
  county: string;
  postcode: string;
  country: string;
  building_name: string;
  building_number: string;
  sub_building_name: string;
  thoroughfare: string;
  latitude: number;
  longitude: number;
  udprn: number;
}

export async function idealPostcodesLookup(postcode: string, apiKey: string): Promise<IdealPostcodesAddress[]> {
  const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { result: IdealPostcodesAddress[]; code: number };
  if (data.code !== 2000 || !data.result) return [];
  return data.result;
}

export async function googleGeocode(address: string, apiKey: string): Promise<GeoResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:GB&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json() as { status: string; results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }> };
  if (data.status !== "OK" || !data.results || data.results.length === 0) return null;
  const result = data.results[0];
  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    display_name: result.formatted_address || address,
  };
}

export async function mapboxGeocode(address: string, apiKey: string): Promise<GeoResult | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${apiKey}&limit=1&country=gb`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json() as { features: Array<{ center: [number, number]; place_name: string }> };
  if (!data.features || data.features.length === 0) return null;
  const [lng, lat] = data.features[0].center;
  return {
    latitude: lat,
    longitude: lng,
    display_name: data.features[0].place_name || address,
  };
}

export async function nominatimSearch(query: string): Promise<Array<{ lat: string; lon: string; display_name: string }>> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=gb`;
  const response = await fetch(url, {
    headers: { "User-Agent": "TradeWorkDesk/1.0" },
  });
  if (!response.ok) return [];
  const results = await response.json();
  return Array.isArray(results) ? results : [];
}

export async function geocodeAddress(address: string, _tenantId?: string): Promise<GeoResult | null> {
  try {
    const idealKey = await getIdealPostcodesKey().catch(() => null);
    if (idealKey) {
      const postcode = extractPostcode(address);
      if (postcode) {
        const addresses = await idealPostcodesLookup(postcode, idealKey);
        if (addresses.length > 0) {
          const addressLower = address.toLowerCase();
          const match = addresses.find(a => {
            const line1 = a.line_1.toLowerCase();
            return addressLower.includes(line1) || line1.includes(addressLower.split(",")[0].trim());
          });
          const best = match || addresses[0];
          if (best.latitude && best.longitude) {
            return {
              latitude: best.latitude,
              longitude: best.longitude,
              display_name: [best.line_1, best.line_2, best.post_town, best.postcode].filter(Boolean).join(", "),
            };
          }
        }
      }
    }

    const googleApiKey = process.env.GOOGLE_GEOCODE_API_KEY;
    if (googleApiKey) {
      const result = await googleGeocode(address, googleApiKey);
      if (result) return result;
    }

    const mapboxApiKey = process.env.GEOCODE_API_KEY;
    if (mapboxApiKey) {
      const result = await mapboxGeocode(address, mapboxApiKey);
      if (result) return result;
    }

    let results = await nominatimSearch(address);

    if (results.length === 0) {
      const postcode = extractPostcode(address);
      if (postcode) {
        results = await nominatimSearch(postcode);
      }
    }

    if (results.length === 0) return null;

    const result = results[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      display_name: result.display_name || address,
    };
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}
