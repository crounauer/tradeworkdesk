import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function extractPostcode(address: string): string | null {
  const match = address.match(UK_POSTCODE_RE);
  return match ? match[1].trim() : null;
}

interface GeoResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

async function googleGeocode(address: string, apiKey: string): Promise<GeoResult | null> {
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

async function mapboxGeocode(address: string, apiKey: string): Promise<GeoResult | null> {
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

async function nominatimSearch(query: string): Promise<Array<{ lat: string; lon: string; display_name: string }>> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=gb`;
  const response = await fetch(url, {
    headers: { "User-Agent": "TradeWorkDesk/1.0" },
  });
  if (!response.ok) return [];
  const results = await response.json();
  return Array.isArray(results) ? results : [];
}

router.post("/geocode", requireAuth, requireTenant, requirePlanFeature("geo_mapping"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { address } = req.body;
  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "Address string is required" });
    return;
  }

  try {
    let tenantGoogleKey: string | null = null;
    if (req.tenantId) {
      const { data: cs } = await supabaseAdmin
        .from("company_settings")
        .select("google_geocode_api_key")
        .eq("tenant_id", req.tenantId)
        .maybeSingle();
      if (cs?.google_geocode_api_key) tenantGoogleKey = cs.google_geocode_api_key;
    }

    const googleApiKey = tenantGoogleKey || process.env.GOOGLE_GEOCODE_API_KEY;
    if (googleApiKey) {
      const result = await googleGeocode(address, googleApiKey);
      if (result) {
        res.json(result);
        return;
      }
    }

    const mapboxApiKey = process.env.GEOCODE_API_KEY;
    if (mapboxApiKey) {
      const result = await mapboxGeocode(address, mapboxApiKey);
      if (result) {
        res.json(result);
        return;
      }
    }

    let results = await nominatimSearch(address);

    if (results.length === 0) {
      const postcode = extractPostcode(address);
      if (postcode) {
        results = await nominatimSearch(postcode);
      }
    }

    if (results.length === 0) {
      res.status(404).json({ error: "Address not found" });
      return;
    }

    const result = results[0];
    res.json({
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      display_name: result.display_name || address,
    });
  } catch (err) {
    console.error("Geocoding error:", err);
    res.status(500).json({ error: "Geocoding failed" });
  }
});

export default router;
