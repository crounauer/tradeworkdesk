import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { GetProfileResponse, UpdateProfileBody, UpdateProfileResponse, ListProfilesResponse, } from "@workspace/api-zod";
const router = Router();
router.get("/auth/profile", requireAuth, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", req.userId)
        .single();
    if (error || !data) {
        res.status(404).json({ error: "Profile not found" });
        return;
    }
    res.json(GetProfileResponse.parse(data));
});
router.patch("/auth/profile", requireAuth, async (req, res) => {
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .update(parsed.data)
        .eq("id", req.userId)
        .select()
        .single();
    if (error || !data) {
        res.status(500).json({ error: "Failed to update profile" });
        return;
    }
    res.json(UpdateProfileResponse.parse(data));
});
router.get("/auth/profiles", requireAuth, async (_req, res) => {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }
    res.json(ListProfilesResponse.parse(data || []));
});
export default router;
