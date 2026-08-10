/**
 * Background cron: activate pending custom domains whose DNS now resolves to the platform.
 * Runs every 2 hours. Prevents "stuck pending" domains after a tenant sets up DNS but
 * never manually re-triggers verification in the UI.
 */
import { promises as dns } from "dns";
import { supabaseAdmin } from "./supabase";
import { addDomainToFly } from "./fly-certs";

const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const FLY_APEX_IPV4 = process.env.FLY_PUBLIC_IPV4 || "66.241.125.253";
const FLY_APEX_IPV6 = process.env.FLY_PUBLIC_IPV6 || "2a09:8280:1::139:7e95:0";
const PLATFORM_TARGET = (process.env.PLATFORM_CNAME_TARGET || "sites.tradeworkdesk.co.uk").toLowerCase();

async function domainPointsToPlatform(domain: string): Promise<boolean> {
  try {
    const cnames = await dns.resolveCname(domain).catch(() => [] as string[]);
    if (cnames.some((c) => c.toLowerCase() === PLATFORM_TARGET || c.toLowerCase().endsWith(`.${PLATFORM_TARGET}`) || c.toLowerCase().endsWith(".fly.dev"))) {
      return true;
    }
  } catch { /* ignore */ }

  try {
    const a = await dns.resolve4(domain).catch(() => [] as string[]);
    if (a.includes(FLY_APEX_IPV4)) return true;
  } catch { /* ignore */ }

  try {
    const aaaa = await dns.resolve6(domain).catch(() => [] as string[]);
    if (aaaa.some((r) => r.toLowerCase() === FLY_APEX_IPV6.toLowerCase())) return true;
  } catch { /* ignore */ }

  return false;
}

async function reconcilePendingDomains(): Promise<void> {
  const { data: pending, error } = await supabaseAdmin
    .from("website_domains")
    .select("id, domain, website_id, tenant_id")
    .eq("is_active", false)
    .eq("is_platform_subdomain", false)
    .not("domain", "is", null)
    .limit(100);

  if (error) {
    console.error("[domain-reconcile] DB query failed:", error.message);
    return;
  }

  if (!pending?.length) return;

  console.log(`[domain-reconcile] Checking ${pending.length} pending domain(s)`);

  for (const row of pending) {
    try {
      const ok = await domainPointsToPlatform(row.domain);
      if (!ok) continue;

      const now = new Date().toISOString();
      await supabaseAdmin.from("website_domains").update({
        verification_status: "verified",
        ssl_status: "active",
        is_active: true,
        dns_checked_at: now,
        activated_at: now,
      }).eq("id", row.id);

      // Set as primary if no other active custom domain exists for this website
      const { data: activeDomains } = await supabaseAdmin
        .from("website_domains")
        .select("id")
        .eq("website_id", row.website_id)
        .eq("is_active", true)
        .eq("is_primary", true)
        .eq("is_platform_subdomain", false)
        .limit(1);

      if (!activeDomains?.length) {
        await supabaseAdmin.from("website_domains").update({ is_primary: true }).eq("id", row.id);
      }

      await addDomainToFly(row.domain);
      console.log(`[domain-reconcile] Activated ${row.domain}`);
    } catch (err) {
      console.error(`[domain-reconcile] Error processing ${row.domain}:`, err);
    }
  }
}

export function startDomainReconcileCron(): void {
  console.log("[domain-reconcile] Starting (runs every 2 hours)");
  reconcilePendingDomains().catch((err) =>
    console.error("[domain-reconcile] Initial run failed:", err)
  );
  setInterval(() => {
    reconcilePendingDomains().catch((err) =>
      console.error("[domain-reconcile] Run failed:", err)
    );
  }, CHECK_INTERVAL_MS);
}
