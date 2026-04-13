import { supabaseAdmin } from "./supabase";

interface EffectiveLimits {
  maxUsers: number;
  maxJobsPerMonth: number;
  baseMaxUsers: number;
  baseMaxJobsPerMonth: number;
  addonExtraUsers: number;
  addonExtraJobs: number;
}

const JOBS_PER_ADDON_UNIT = 50;

export async function getEffectiveLimits(tenantId: string): Promise<EffectiveLimits> {
  const [tenantRes, addonsRes] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(max_users, max_jobs_per_month)")
      .eq("id", tenantId)
      .single(),
    supabaseAdmin
      .from("tenant_addons")
      .select("quantity, addons(feature_keys)")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);

  const plans = tenantRes.data?.plans as { max_users?: number; max_jobs_per_month?: number } | null;
  const baseMaxUsers = plans?.max_users ?? 999;
  const baseMaxJobsPerMonth = plans?.max_jobs_per_month ?? 9999;

  let addonExtraUsers = 0;
  let addonExtraJobs = 0;

  if (addonsRes.data) {
    for (const ta of addonsRes.data) {
      const keys = (ta.addons as { feature_keys?: string[] } | null)?.feature_keys ?? [];
      const qty = (ta as { quantity?: number }).quantity ?? 1;
      if (keys.includes("additional_users")) {
        addonExtraUsers += qty;
      }
      if (keys.includes("jobs_per_month")) {
        addonExtraJobs += qty * JOBS_PER_ADDON_UNIT;
      }
    }
  }

  return {
    maxUsers: baseMaxUsers + addonExtraUsers,
    maxJobsPerMonth: baseMaxJobsPerMonth === 9999 ? 9999 : baseMaxJobsPerMonth + addonExtraJobs,
    baseMaxUsers,
    baseMaxJobsPerMonth,
    addonExtraUsers,
    addonExtraJobs,
  };
}

export async function getCurrentUserCount(tenantId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  return count || 0;
}

export async function getActiveInviteCount(tenantId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("used_at", null);
  return count || 0;
}

export async function hasActiveAddon(tenantId: string, featureKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("tenant_addons")
    .select("id, addons(feature_keys)")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (!data) return false;

  return data.some((ta) => {
    const keys = (ta.addons as { feature_keys?: string[] } | null)?.feature_keys ?? [];
    return keys.includes(featureKey);
  });
}

export async function getJobsThisMonth(tenantId: string): Promise<number> {
  const now = new Date();
  const startOfMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count } = await supabaseAdmin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", startOfMonthUTC);
  return count || 0;
}
