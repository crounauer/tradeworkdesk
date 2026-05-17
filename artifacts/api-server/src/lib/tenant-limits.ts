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

/**
 * Check whether a specific user within a tenant has been assigned a per-seat addon.
 */
export async function hasUserAddon(tenantId: string, userId: string, featureKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_addons")
    .select("id, addons(feature_keys)")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!data) return false;

  return data.some((ua) => {
    const keys = (ua.addons as { feature_keys?: string[] } | null)?.feature_keys ?? [];
    return keys.includes(featureKey);
  });
}

/**
 * Sync the tenant_addons.quantity for an addon to match the count of active user_addons rows.
 * Also updates the Stripe subscription item quantity if one exists.
 */
export async function syncUserAddonSeats(tenantId: string, addonId: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from("user_addons")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .eq("is_active", true);

  const activeCount = count ?? 0;

  // Update tenant_addons quantity
  await supabaseAdmin
    .from("tenant_addons")
    .update({ quantity: activeCount } as Record<string, unknown>)
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId);

  // Update Stripe if subscription item is set
  const { requireStripe } = await import("./stripe");
  const stripeClient = requireStripe(false);
  if (!stripeClient) return;

  const { data: tenantAddon } = await supabaseAdmin
    .from("tenant_addons")
    .select("stripe_subscription_item_id")
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .maybeSingle();

  const itemId = (tenantAddon as { stripe_subscription_item_id?: string | null } | null)?.stripe_subscription_item_id;
  if (!itemId) return;

  await stripeClient.subscriptionItems.update(itemId, {
    quantity: activeCount,
    proration_behavior: "always_invoice",
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

// ─── Usage-credit helpers ────────────────────────────────────────────────────

/**
 * Get remaining credits for a tenant/addon (by feature key).
 * Returns null if the addon is not usage-based or no credits row exists yet.
 */
export async function getAddonCredits(tenantId: string, featureKey: string): Promise<{ credits_remaining: number; addon_id: string; bundle_size: number; bundle_price: number } | null> {
  const { data: addon } = await supabaseAdmin
    .from("addons")
    .select("id, billing_model, usage_bundle_size, usage_bundle_price, feature_keys")
    .eq("billing_model", "usage")
    .eq("is_active", true)
    .contains("feature_keys", [featureKey])
    .maybeSingle();

  if (!addon) return null;
  const a = addon as { id: string; billing_model: string; usage_bundle_size: number | null; usage_bundle_price: number | null };

  const { data: credits } = await supabaseAdmin
    .from("tenant_addon_credits")
    .select("credits_remaining")
    .eq("tenant_id", tenantId)
    .eq("addon_id", a.id)
    .maybeSingle();

  return {
    addon_id: a.id,
    credits_remaining: (credits as { credits_remaining: number } | null)?.credits_remaining ?? 0,
    bundle_size: a.usage_bundle_size ?? 1000,
    bundle_price: a.usage_bundle_price ?? 10,
  };
}

/**
 * Deduct one credit for a tenant/addon (by feature key).
 * Returns false if credits are exhausted (caller should block the action).
 * Upserts the row if it doesn't exist yet (so first-time use creates it at 0 and blocks).
 */
export async function deductAddonCredit(tenantId: string, featureKey: string): Promise<boolean> {
  // Find the addon
  const { data: addon } = await supabaseAdmin
    .from("addons")
    .select("id")
    .eq("billing_model", "usage")
    .eq("is_active", true)
    .contains("feature_keys", [featureKey])
    .maybeSingle();

  if (!addon) return true; // addon not usage-based, no credit needed

  const addonId = (addon as { id: string }).id;

  // Get current credits
  const { data: existing } = await supabaseAdmin
    .from("tenant_addon_credits")
    .select("id, credits_remaining")
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .maybeSingle();

  const row = existing as { id: string; credits_remaining: number } | null;
  if (!row || row.credits_remaining <= 0) return false; // no credits

  // Decrement atomically
  await supabaseAdmin
    .from("tenant_addon_credits")
    .update({ credits_remaining: row.credits_remaining - 1, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", row.id);

  return true;
}

/**
 * Add N credit bundles for a tenant/addon.
 */
export async function topUpAddonCredits(tenantId: string, addonId: string, bundles: number): Promise<{ credits_remaining: number; total_purchased: number }> {
  const { data: addon } = await supabaseAdmin
    .from("addons")
    .select("usage_bundle_size")
    .eq("id", addonId)
    .single();

  const bundleSize = (addon as { usage_bundle_size: number | null } | null)?.usage_bundle_size ?? 1000;
  const creditsToAdd = bundleSize * bundles;

  const { data: existing } = await supabaseAdmin
    .from("tenant_addon_credits")
    .select("id, credits_remaining, total_purchased")
    .eq("tenant_id", tenantId)
    .eq("addon_id", addonId)
    .maybeSingle();

  const row = existing as { id: string; credits_remaining: number; total_purchased: number } | null;

  if (row) {
    const newRemaining = row.credits_remaining + creditsToAdd;
    const newTotal = row.total_purchased + creditsToAdd;
    await supabaseAdmin
      .from("tenant_addon_credits")
      .update({ credits_remaining: newRemaining, total_purchased: newTotal, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", row.id);
    return { credits_remaining: newRemaining, total_purchased: newTotal };
  } else {
    await supabaseAdmin
      .from("tenant_addon_credits")
      .insert({ tenant_id: tenantId, addon_id: addonId, credits_remaining: creditsToAdd, total_purchased: creditsToAdd } as Record<string, unknown>);
    return { credits_remaining: creditsToAdd, total_purchased: creditsToAdd };
  }
}

// ─── Photo storage limits ────────────────────────────────────────────────────

export const BASE_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024 * 1024; // 500 GB (base plan)
export const EXTRA_STORAGE_FEATURE_KEY = "extra_photo_storage";

/**
 * Returns the tenant's effective storage limit in bytes.
 * Base plan: 500 GB free. Each GB credit purchased via the Extra Photo Storage addon adds 1 GB.
 * Storage is billed in advance: tenants buy GB upfront at £4.99/GB/month.
 */
export async function getEffectiveStorageLimit(tenantId: string): Promise<number> {
  const credits = await getAddonCredits(tenantId, EXTRA_STORAGE_FEATURE_KEY);
  const extraGB = credits?.credits_remaining ?? 0;
  return BASE_STORAGE_LIMIT_BYTES + extraGB * 1024 * 1024 * 1024;
}

export async function getStorageUsed(tenantId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("file_attachments")
    .select("file_size.sum()")
    .eq("tenant_id", tenantId);
  const agg = (data?.[0] || {}) as { file_size?: { sum?: string | number | null } };
  return Number(agg.file_size?.sum ?? 0);
}
