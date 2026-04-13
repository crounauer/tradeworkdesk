import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

const planFeaturesCache = new Map<string, { features: Record<string, unknown>; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 60_000;

const tenantStatusCache = new Map<string, { status: string; trial_ends_at: string | null; expiresAt: number }>();
const TENANT_STATUS_CACHE_TTL_MS = 60_000;

const profileCache = new Map<string, { role: string; tenant_id: string | null; expiresAt: number }>();
const PROFILE_CACHE_TTL_MS = 120_000;

const mfaCache = new Map<string, { hasVerifiedTotp: boolean; expiresAt: number }>();
const MFA_CACHE_TTL_MS = 120_000;

type CachedUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
const tokenUserCache = new Map<string, { user: CachedUser; expiresAt: number }>();
const tokenInflight = new Map<string, Promise<CachedUser | null>>();
const TOKEN_CACHE_TTL_MS = 60_000;
const TOKEN_CACHE_MAX_SIZE = 500;

function cleanTokenCache() {
  if (tokenUserCache.size <= TOKEN_CACHE_MAX_SIZE) return;
  const now = Date.now();
  for (const [key, val] of tokenUserCache) {
    if (val.expiresAt <= now) tokenUserCache.delete(key);
  }
  if (tokenUserCache.size > TOKEN_CACHE_MAX_SIZE) {
    const entries = [...tokenUserCache.entries()];
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, entries.length - TOKEN_CACHE_MAX_SIZE);
    for (const [key] of toRemove) tokenUserCache.delete(key);
  }
}

async function resolveTokenUser(token: string): Promise<CachedUser | null> {
  const now = Date.now();

  const cached = tokenUserCache.get(token);
  if (cached && cached.expiresAt > now) return cached.user;

  const inflight = tokenInflight.get(token);
  if (inflight) return inflight;

  const payload = decodeJwtPayload(token);
  const jwtSub = payload?.sub as string | undefined;
  if (jwtSub) {
    const uidInflight = tokenInflight.get(`uid:${jwtSub}`);
    if (uidInflight) {
      return uidInflight.then((u) => {
        if (u) {
          const entry = { user: u, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS };
          tokenUserCache.set(token, entry);
        }
        return u;
      });
    }
  }

  const promise = (async (): Promise<CachedUser | null> => {
    const { data: { user: fetchedUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !fetchedUser) return null;
    const slim: CachedUser = { id: fetchedUser.id, email: fetchedUser.email, user_metadata: fetchedUser.user_metadata };
    const entry = { user: slim, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS };
    cleanTokenCache();
    tokenUserCache.set(token, entry);
    return slim;
  })();

  tokenInflight.set(token, promise);
  if (jwtSub) tokenInflight.set(`uid:${jwtSub}`, promise);
  try {
    return await promise;
  } finally {
    tokenInflight.delete(token);
    if (jwtSub) tokenInflight.delete(`uid:${jwtSub}`);
  }
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  userEmail?: string;
  tenantId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const t0 = Date.now();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.substring(7);

  const user = await resolveTokenUser(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const now = Date.now();

  const cachedMfa = mfaCache.get(user.id);
  const cachedProfile = profileCache.get(user.id);
  const needsMfa = !cachedMfa || cachedMfa.expiresAt <= now;
  const needsProfile = !cachedProfile || cachedProfile.expiresAt <= now;

  const parallel: Promise<unknown>[] = [];

  if (needsMfa) {
    parallel.push(
      supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id }).then(({ data: factors, error: mfaError }) => {
        if (mfaError) return;
        const hasVerifiedTotp = factors?.factors?.some((f: { status: string; factor_type: string }) => f.factor_type === "totp" && f.status === "verified") ?? false;
        mfaCache.set(user.id, { hasVerifiedTotp, expiresAt: Date.now() + MFA_CACHE_TTL_MS });
      })
    );
  }

  if (needsProfile) {
    parallel.push(
      supabaseAdmin
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", user.id)
        .single()
        .then(({ data: dbProfile }) => {
          if (dbProfile) {
            profileCache.set(user.id, { ...dbProfile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
          }
        })
    );
  }

  if (parallel.length > 0) await Promise.all(parallel);

  const mfaEntry = mfaCache.get(user.id);
  const hasVerifiedTotp = mfaEntry?.hasVerifiedTotp ?? false;

  if (hasVerifiedTotp) {
    const decoded = decodeJwtPayload(token);
    if (decoded?.aal !== "aal2") {
      res.status(403).json({ error: "MFA verification required" });
      return;
    }
  }

  const profileEntry = profileCache.get(user.id);
  let profile: { role: string; tenant_id: string | null } | null = profileEntry
    ? { role: profileEntry.role, tenant_id: profileEntry.tenant_id }
    : null;

  if (!profile) {
    const fullName =
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    const { count: adminCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const role = (adminCount ?? 0) === 0 ? "admin" : "technician";

    const { data: created } = await supabaseAdmin
      .from("profiles")
      .insert({ id: user.id, email: user.email, full_name: fullName, role })
      .select("role, tenant_id")
      .single();

    profile = created;
    if (profile) {
      profileCache.set(user.id, { ...profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    }
  } else if (profile.role === "technician") {
    const { count: adminCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((adminCount ?? 0) === 0) {
      await supabaseAdmin
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", user.id);
      profile = { ...profile, role: "admin" };
      profileCache.set(user.id, { ...profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    }
  }

  req.userId = user.id;
  req.userRole = profile?.role || "technician";
  req.userEmail = user.email;
  req.tenantId = profile?.tenant_id || undefined;

  const authMs = Date.now() - t0;
  if (authMs > 50) {
    console.log(`[perf] requireAuth ${req.path} ${authMs}ms (user:${user.id.slice(0,8)})`);
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.userRole !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}

export async function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.userRole === "super_admin") {
    next();
    return;
  }
  if (!req.tenantId) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return;
  }

  const now = Date.now();
  let cached = tenantStatusCache.get(req.tenantId);
  if (!cached || cached.expiresAt <= now) {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("status, trial_ends_at")
      .eq("id", req.tenantId)
      .single();

    if (tenant) {
      cached = { status: tenant.status, trial_ends_at: tenant.trial_ends_at, expiresAt: Date.now() + TENANT_STATUS_CACHE_TTL_MS };
      tenantStatusCache.set(req.tenantId, cached);
    }
  }

  if (cached) {
    if (cached.status === "cancelled") {
      res.status(403).json({ error: "account_cancelled", message: "This account has been cancelled." });
      return;
    }
    if (cached.status === "suspended") {
      res.status(403).json({ error: "account_suspended", message: "This account has been suspended. Please contact support or update your payment method." });
      return;
    }
    if (cached.status === "trial" && cached.trial_ends_at) {
      const trialEnd = new Date(cached.trial_ends_at).getTime();
      if (trialEnd < now) {
        const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
        await Promise.all([
          supabaseAdmin
            .from("tenants")
            .update({ plan_id: FREE_PLAN_ID, status: "active", trial_ends_at: null })
            .eq("id", req.tenantId),
          supabaseAdmin
            .from("tenant_addons")
            .update({ is_active: false })
            .eq("tenant_id", req.tenantId!)
            .eq("is_active", true),
        ]);
        cached.status = "active";
        cached.trial_ends_at = null;
        tenantStatusCache.set(req.tenantId!, { ...cached, expiresAt: Date.now() + TENANT_STATUS_CACHE_TTL_MS });
      }
    }
  }

  next();
}

export async function getTenantFeatures(tenantId: string): Promise<Record<string, unknown> | null> {
  const now = Date.now();
  const cached = planFeaturesCache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.features;
  }

  const [tenantRes, addonsRes] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(features)")
      .eq("id", tenantId)
      .single(),
    supabaseAdmin
      .from("tenant_addons")
      .select("addon_id, addons(feature_keys)")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);

  if (tenantRes.error || !tenantRes.data) return null;

  const planFeatures =
    (tenantRes.data.plans as { features?: Record<string, unknown> } | null)
      ?.features ?? {};

  const features: Record<string, unknown> = { ...planFeatures };

  if (addonsRes.data) {
    for (const ta of addonsRes.data) {
      const addon = ta.addons as { feature_keys?: string[] } | null;
      if (addon?.feature_keys) {
        for (const key of addon.feature_keys) {
          features[key] = true;
        }
      }
    }
  }

  planFeaturesCache.set(tenantId, { features, expiresAt: now + PLAN_CACHE_TTL_MS });
  return features;
}

export function requirePlanFeature(featureName: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (req.userRole === "super_admin") {
      next();
      return;
    }

    if (!req.tenantId) {
      res.status(403).json({ error: "No tenant associated with this account" });
      return;
    }

    const features = await getTenantFeatures(req.tenantId);

    if (features === null) {
      res.status(403).json({ error: "Could not verify plan features" });
      return;
    }

    if (!features[featureName]) {
      res.status(402).json({
        error: "Plan upgrade required",
        feature: featureName,
      });
      return;
    }

    next();
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
