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
    // First user in the system becomes admin; everyone else gets technician.
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const role = (count ?? 0) === 0 ? "admin" : "technician";
    const fullName =
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    const { data: created } = await supabaseAdmin
      .from("profiles")
      .insert({ id: user.id, email: user.email, full_name: fullName, role })
      .select("role")
      .single();

    profile = created;
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
