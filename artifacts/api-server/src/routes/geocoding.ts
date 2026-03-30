import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

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

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=gb`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BoilerTechApp/1.0",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Geocoding service error" });
      return;
    }

    const results = await response.json();
    if (!results || results.length === 0) {
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
