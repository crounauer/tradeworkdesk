import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  userEmail?: string;
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Auto-provision a profile for users who signed up before the DB trigger ran.
    const fullName =
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    // Check whether any admin already exists so we know what role to assign.
    const { count: adminCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const role = (adminCount ?? 0) === 0 ? "admin" : "technician";

    const { data: created } = await supabaseAdmin
      .from("profiles")
      .insert({ id: user.id, email: user.email, full_name: fullName, role })
      .select("role")
      .single();

    profile = created;
  } else if (profile.role === "technician") {
    // If this user is a technician but NO admin exists yet, promote them.
    // This handles the case where the Supabase sign-up trigger assigned the
    // default 'technician' role before anyone manually set an admin account.
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
