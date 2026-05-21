import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";
import { supabaseAdmin } from "../lib/supabase";

const invoicingEnabledCache = new Map<string, { enabled: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Middleware that checks company_settings.invoices_enabled for the current tenant.
 * Must run after requireTenant so req.tenantId is populated.
 * Super-admins bypass this check.
 */
export async function requireTenantInvoicing(
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
  const cached = invoicingEnabledCache.get(req.tenantId);
  if (cached && cached.expiresAt > now) {
    if (!cached.enabled) {
      res.status(403).json({ error: "Invoicing is not enabled for this company. Enable it in Admin → Company Settings." });
      return;
    }
    next();
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .select("invoices_enabled")
    .eq("tenant_id", req.tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: "Failed to verify invoicing settings" });
    return;
  }

  // If no settings row exists yet, default to enabled (permissive fallback)
  const enabled = data === null ? true : data.invoices_enabled !== false;
  invoicingEnabledCache.set(req.tenantId, { enabled, expiresAt: now + CACHE_TTL_MS });

  if (!enabled) {
    res.status(403).json({ error: "Invoicing is not enabled for this company. Enable it in Admin → Company Settings." });
    return;
  }

  next();
}

/**
 * Exported so that the admin route can bust the cache after toggling invoices_enabled.
 */
export function bustInvoicingCache(tenantId: string): void {
  invoicingEnabledCache.delete(tenantId);
}
