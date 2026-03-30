import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

const planFeaturesCache = new Map<string, { features: Record<string, unknown>; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 60_000;

const profileCache = new Map<string, { role: string; tenant_id: string | null; expiresAt: number }>();
const PROFILE_CACHE_TTL_MS = 30_000;

const mfaCache = new Map<string, { hasVerifiedTotp: boolean; expiresAt: number }>();
const MFA_CACHE_TTL_MS = 5_000;

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
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const now = Date.now();

  const cachedMfa = mfaCache.get(user.id);
  let hasVerifiedTotp: boolean;
  if (cachedMfa && cachedMfa.expiresAt > now) {
    hasVerifiedTotp = cachedMfa.hasVerifiedTotp;
  } else {
    const { data: factors, error: mfaError } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
    if (mfaError) {
      res.status(503).json({ error: "Unable to verify MFA status" });
      return;
    }
    hasVerifiedTotp = factors?.factors?.some((f: { status: string; factor_type: string }) => f.factor_type === "totp" && f.status === "verified") ?? false;
    mfaCache.set(user.id, { hasVerifiedTotp, expiresAt: now + MFA_CACHE_TTL_MS });
  }

  if (hasVerifiedTotp) {
    const decoded = decodeJwtPayload(token);
    if (decoded?.aal !== "aal2") {
      res.status(403).json({ error: "MFA verification required" });
      return;
    }
  }

  const cachedProfile = profileCache.get(user.id);

  let profile: { role: string; tenant_id: string | null } | null = null;

  if (cachedProfile && cachedProfile.expiresAt > now) {
    profile = cachedProfile;
  } else {
    const { data: dbProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single();

    if (!dbProfile) {
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
    } else if (dbProfile.role === "technician") {
      const { count: adminCount } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if ((adminCount ?? 0) === 0) {
        await supabaseAdmin
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", user.id);
        profile = { ...dbProfile, role: "admin" };
      } else {
        profile = dbProfile;
      }
    } else {
      profile = dbProfile;
    }

    if (profile) {
      profileCache.set(user.id, { ...profile, expiresAt: now + PROFILE_CACHE_TTL_MS });
    }
  }

  req.userId = user.id;
  req.userRole = profile?.role || "technician";
  req.userEmail = user.email;
  req.tenantId = profile?.tenant_id || undefined;

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

export function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.userRole === "super_admin") {
    next();
    return;
  }
  if (!req.tenantId) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return;
  }
  next();
}

export async function getTenantFeatures(tenantId: string): Promise<Record<string, unknown> | null> {
  const now = Date.now();
  const cached = planFeaturesCache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.features;
  }

  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("plan_id, plans(features)")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) return null;

  const features =
    (tenant.plans as { features?: Record<string, unknown> } | null)
      ?.features ?? {};

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
