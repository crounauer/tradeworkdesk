import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

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

  let { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

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

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(features)")
      .eq("id", req.tenantId)
      .single();

    if (error || !tenant) {
      res.status(403).json({ error: "Could not verify plan features" });
      return;
    }

    const features =
      (tenant.plans as { features?: Record<string, unknown> } | null)
        ?.features ?? {};

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
