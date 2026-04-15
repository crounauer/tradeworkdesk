import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function extractPostcode(address: string): string | null {
  const match = address.match(UK_POSTCODE_RE);
  return match ? match[1].trim() : null;
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
    const geocodeApiKey = process.env.GEOCODE_API_KEY;

    if (geocodeApiKey) {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${geocodeApiKey}&limit=1&country=gb`;
      const response = await fetch(url);
      if (!response.ok) {
        res.status(502).json({ error: "Geocoding service error" });
        return;
      }
      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        res.status(404).json({ error: "Address not found" });
        return;
      }
      const [lng, lat] = data.features[0].center;
      res.json({
        latitude: lat,
        longitude: lng,
        display_name: data.features[0].place_name || address,
      });
      return;
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
