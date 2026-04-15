import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { geocodeAddress, getIdealPostcodesKey, idealPostcodesLookup } from "../lib/geocode";
import { hasActiveAddon } from "../lib/tenant-limits";

const router: IRouter = Router();

router.post("/geocode", requireAuth, requireTenant, requirePlanFeature("geo_mapping"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { address } = req.body;
  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "Address string is required" });
    return;
  }

  const result = await geocodeAddress(address, req.tenantId);
  if (!result) {
    res.status(404).json({ error: "Address not found" });
    return;
  }

  res.json(result);
});

router.post("/postcode-lookup", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { postcode } = req.body;
  if (!postcode || typeof postcode !== "string") {
    res.status(400).json({ error: "Postcode is required" });
    return;
  }

  const addonActive = await hasActiveAddon(req.tenantId!, "uk_address_lookup");
  if (!addonActive) {
    res.status(402).json({ error: "UK Address Lookup add-on required. Contact your administrator to activate this feature." });
    return;
  }

  try {
    const apiKey = await getIdealPostcodesKey();
    if (!apiKey) {
      res.status(404).json({ error: "Address lookup not configured" });
      return;
    }

    const addresses = await idealPostcodesLookup(postcode.trim(), apiKey);
    if (addresses.length === 0) {
      res.status(404).json({ error: "No addresses found for this postcode" });
      return;
    }

    const results = addresses.map(a => ({
      line_1: a.line_1,
      line_2: a.line_2,
      line_3: a.line_3,
      post_town: a.post_town,
      county: a.county,
      postcode: a.postcode,
      latitude: a.latitude,
      longitude: a.longitude,
      display: [a.line_1, a.line_2, a.line_3].filter(Boolean).join(", "),
    }));

    res.json({ addresses: results });
  } catch (err) {
    console.error("Postcode lookup error:", err);
    res.status(500).json({ error: "Postcode lookup failed" });
  }
});

export default router;
