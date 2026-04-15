import { supabaseAdmin } from "./supabase";

interface EffectiveLimits {
  maxUsers: number;
  maxJobsPerMonth: number;
  baseMaxUsers: number;
  baseMaxJobsPerMonth: number;
  addonExtraUsers: number;
  addonExtraJobs: number;
  isTrial: boolean;
}

const JOBS_PER_ADDON_UNIT = 25;

interface PreFetchedTenantData {
  status?: string;
  trial_ends_at?: string | null;
  plans?: { max_users?: number; max_jobs_per_month?: number } | null;
}

interface PreFetchedAddon {
  quantity?: number;
  addons?: { feature_keys?: string[] } | null;
}

function computeLimitsFromData(
  tenant: PreFetchedTenantData | null,
  addons: PreFetchedAddon[] | null,
): EffectiveLimits {
  const tenantStatus = tenant?.status;
  const trialEndsAt = tenant?.trial_ends_at;
  const isTrial = tenantStatus === "trial" && !!trialEndsAt && new Date(trialEndsAt) > new Date();

  const plans = tenant?.plans;
  const baseMaxUsers = plans?.max_users ?? 999;
  const baseMaxJobsPerMonth = plans?.max_jobs_per_month ?? 9999;

  let addonExtraUsers = 0;
  let addonExtraJobs = 0;

  if (addons) {
    for (const ta of addons) {
      const keys = ta.addons?.feature_keys ?? [];
      const qty = ta.quantity ?? 1;
      if (keys.includes("additional_users")) {
        addonExtraUsers += qty;
      }
      if (keys.includes("jobs_per_month")) {
        addonExtraJobs += qty * JOBS_PER_ADDON_UNIT;
      }
    }
  }

  return {
    maxUsers: isTrial ? 999 : baseMaxUsers + addonExtraUsers,
    maxJobsPerMonth: isTrial ? 9999 : (baseMaxJobsPerMonth === 9999 ? 9999 : baseMaxJobsPerMonth + addonExtraJobs),
    baseMaxUsers,
    baseMaxJobsPerMonth,
    addonExtraUsers,
    addonExtraJobs,
    isTrial,
  };
}

export function getEffectiveLimitsFromCache(
  tenant: PreFetchedTenantData | null,
  addons: PreFetchedAddon[] | null,
): EffectiveLimits {
  return computeLimitsFromData(tenant, addons);
}

export async function getEffectiveLimits(tenantId: string): Promise<EffectiveLimits> {
  const [tenantRes, addonsRes] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("plan_id, status, trial_ends_at, plans(max_users, max_jobs_per_month)")
      .eq("id", tenantId)
      .single(),
    supabaseAdmin
      .from("tenant_addons")
      .select("quantity, addons(feature_keys)")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);

  return computeLimitsFromData(
    tenantRes.data as PreFetchedTenantData | null,
    addonsRes.data as PreFetchedAddon[] | null,
  );
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
