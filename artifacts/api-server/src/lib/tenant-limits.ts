import { supabaseAdmin } from "./supabase";

// Simple pricing model: one plan, £25/month, 2 users included.
// Extra users are billed at £10/month each via Stripe (no hard DB cap beyond the
// base plan max_users=2 — Stripe handles the billing for additional seats).
// Jobs are unlimited (max_jobs_per_month is NULL on the new plan).

export interface EffectiveLimits {
  maxUsers: number;
  maxJobsPerMonth: number; // 9999 = unlimited
  baseMaxUsers: number;
  baseMaxJobsPerMonth: number;
  addonExtraUsers: number;
  addonExtraJobs: number;
  isTrial: boolean;
}

interface PreFetchedTenantData {
  status?: string;
  trial_ends_at?: string | null;
  plans?: { max_users?: number; max_jobs_per_month?: number | null } | null;
}

function computeLimitsFromData(
  tenant: PreFetchedTenantData | null,
): EffectiveLimits {
  const tenantStatus = tenant?.status;
  const trialEndsAt = tenant?.trial_ends_at;
  const isTrial = tenantStatus === "trial" && !!trialEndsAt && new Date(trialEndsAt) > new Date();

  const plans = tenant?.plans;
  // max_users = 2 on the new plan; NULL max_jobs_per_month = unlimited (9999)
  const baseMaxUsers = plans?.max_users ?? 2;
  const baseMaxJobsPerMonth = 9999; // unlimited — new plan has no job cap

  return {
    maxUsers: isTrial ? 999 : baseMaxUsers,
    maxJobsPerMonth: 9999,
    baseMaxUsers,
    baseMaxJobsPerMonth,
    addonExtraUsers: 0,
    addonExtraJobs: 0,
    isTrial,
  };
}

export function getEffectiveLimitsFromCache(
  tenant: PreFetchedTenantData | null,
): EffectiveLimits {
  return computeLimitsFromData(tenant);
}

export async function getEffectiveLimits(tenantId: string): Promise<EffectiveLimits> {
  const { data: tenantRes } = await supabaseAdmin
    .from("tenants")
    .select("plan_id, status, trial_ends_at, plans(max_users, max_jobs_per_month)")
    .eq("id", tenantId)
    .single();

  return computeLimitsFromData(tenantRes as PreFetchedTenantData | null);
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
