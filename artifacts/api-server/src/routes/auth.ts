import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  GetProfileResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  ListProfilesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/auth/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", req.userId!)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(GetProfileResponse.parse(data));
});

router.patch("/auth/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(parsed.data)
    .eq("id", req.userId!)
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: "Failed to update profile" });
    return;
  }

  res.json(UpdateProfileResponse.parse(data));
});

const profilesListCache = new Map<string, { data: unknown; ts: number }>();
const PROFILES_CACHE_TTL_MS = 120_000;

router.get("/auth/profiles", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const cacheKey = req.tenantId || "none";
  const cached = profilesListCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PROFILES_CACHE_TTL_MS) {
    res.set("Cache-Control", "private, max-age=120");
    res.set("X-Cache", "HIT");
    res.json(cached.data);
    return;
  }

  let q = supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, phone, tenant_id, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("full_name");

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const responseBody = ListProfilesResponse.parse(data || []);
  profilesListCache.set(cacheKey, { data: responseBody, ts: Date.now() });
  res.set("Cache-Control", "private, max-age=120");
  res.set("X-Cache", "MISS");
  res.json(responseBody);
});

export default router;
