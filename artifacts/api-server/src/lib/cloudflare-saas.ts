/**
 * Cloudflare for SaaS integration
 *
 * Manages custom hostname provisioning on Cloudflare so tenant websites
 * can be served on their own domain with automatic SSL.
 *
 * Setup required (in platform_settings or env vars):
 *   CF_ZONE_ID          — your Cloudflare zone ID (the platform's zone)
 *   CF_API_TOKEN        — API token with Zone:Custom Hostnames:Edit permission
 *
 * How it works:
 *   1. Tenant adds their domain in the business app
 *   2. We call createCustomHostname() → Cloudflare returns a verification token
 *      and ssl_status
 *   3. We show the tenant the DNS records they need to add:
 *      - CNAME  @ → your-platform.co.uk  (or A record)
 *      - TXT    _cf-custom-hostname → <verification_token>
 *   4. Cloudflare polls for DNS propagation and provisions SSL automatically
 *   5. We poll getCustomHostnameStatus() on a schedule to update ssl_status
 *
 * Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 */

import { supabaseAdmin } from "./supabase";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

interface CfApiCredentials {
  zoneId: string;
  apiToken: string;
}

interface CfCustomHostname {
  id: string;
  hostname: string;
  ssl: {
    status: string;
    validation_records?: Array<{
      txt_name: string;
      txt_value: string;
    }>;
  };
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  };
  ownership_verification_http?: {
    http_url: string;
    http_body: string;
  };
  status: string;
}

async function getCfCredentials(): Promise<CfApiCredentials | null> {
  const zoneId = process.env.CF_ZONE_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (zoneId && apiToken) {
    return { zoneId, apiToken };
  }

  // Fall back to platform_settings
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["cf_zone_id", "cf_api_token"]);

  const map = Object.fromEntries((data || []).map((r: Record<string, string>) => [r.key, r.value]));

  if (!map.cf_zone_id || !map.cf_api_token) return null;
  return { zoneId: map.cf_zone_id, apiToken: map.cf_api_token };
}

async function cfRequest<T>(
  method: string,
  path: string,
  credentials: CfApiCredentials,
  body?: unknown,
): Promise<{ result: T; success: boolean; errors: Array<{ message: string }> }> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${credentials.apiToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as { result: T; success: boolean; errors: Array<{ message: string }> };
  return json;
}

/**
 * Provision a custom hostname on Cloudflare for SaaS.
 * Returns the Cloudflare hostname ID and initial SSL/verification status.
 * Call this when a tenant first adds their domain.
 */
export async function createCustomHostname(domain: string): Promise<{
  ok: boolean;
  hostnameId?: string;
  ownershipToken?: string;
  sslStatus?: string;
  error?: string;
}> {
  const creds = await getCfCredentials();
  if (!creds) {
    return { ok: false, error: "Cloudflare not configured. Set CF_ZONE_ID and CF_API_TOKEN." };
  }

  const { result, success, errors } = await cfRequest<CfCustomHostname>(
    "POST",
    `/zones/${creds.zoneId}/custom_hostnames`,
    creds,
    {
      hostname: domain,
      ssl: {
        method: "txt",
        type: "dv",
        settings: {
          http2: "on",
          min_tls_version: "1.2",
        },
      },
    },
  );

  if (!success) {
    const msg = errors?.[0]?.message || "Cloudflare API error";
    console.error(`[cloudflare] createCustomHostname failed for ${domain}:`, msg);
    return { ok: false, error: msg };
  }

  // Extract the TXT record the tenant needs to add for ownership verification
  const ownershipToken = result.ownership_verification?.value
    || result.ownership_verification_http?.http_body
    || undefined;

  return {
    ok: true,
    hostnameId: result.id,
    ownershipToken,
    sslStatus: result.ssl?.status,
  };
}

/**
 * Get current SSL and ownership verification status for a custom hostname.
 * Call this from a background job to keep website_domains up to date.
 */
export async function getCustomHostnameStatus(cfHostnameId: string): Promise<{
  ok: boolean;
  status?: string;
  sslStatus?: string;
  ownershipVerified?: boolean;
  sslVerified?: boolean;
  error?: string;
}> {
  const creds = await getCfCredentials();
  if (!creds) return { ok: false, error: "Cloudflare not configured" };

  const { result, success, errors } = await cfRequest<CfCustomHostname>(
    "GET",
    `/zones/${creds.zoneId}/custom_hostnames/${cfHostnameId}`,
    creds,
  );

  if (!success) {
    return { ok: false, error: errors?.[0]?.message || "Cloudflare API error" };
  }

  return {
    ok: true,
    status: result.status,
    sslStatus: result.ssl?.status,
    ownershipVerified: result.status === "active",
    sslVerified: result.ssl?.status === "active",
  };
}

/**
 * Delete a custom hostname from Cloudflare.
 * Call this when a tenant removes their domain or their account is cancelled.
 */
export async function deleteCustomHostname(cfHostnameId: string): Promise<{ ok: boolean; error?: string }> {
  const creds = await getCfCredentials();
  if (!creds) return { ok: false, error: "Cloudflare not configured" };

  const { success, errors } = await cfRequest<Record<string, unknown>>(
    "DELETE",
    `/zones/${creds.zoneId}/custom_hostnames/${cfHostnameId}`,
    creds,
  );

  if (!success) {
    return { ok: false, error: errors?.[0]?.message || "Cloudflare API error" };
  }

  return { ok: true };
}

/**
 * Sync domain status from Cloudflare into the website_domains table.
 * Called by the background polling job.
 */
export async function syncDomainStatus(domainId: string): Promise<void> {
  const db = supabaseAdmin as any;

  const { data: domain } = await db
    .from("website_domains")
    .select("id, domain, cf_hostname_id, ssl_status, verification_status")
    .eq("id", domainId)
    .single() as { data: Record<string, unknown> | null };

  if (!domain?.cf_hostname_id) return;

  const status = await getCustomHostnameStatus(domain.cf_hostname_id as string);
  if (!status.ok) return;

  const updates: Record<string, unknown> = {
    ssl_checked_at: new Date().toISOString(),
    dns_checked_at: new Date().toISOString(),
    cf_ownership_verified: status.ownershipVerified ?? false,
    cf_ssl_verified: status.sslVerified ?? false,
  };

  if (status.sslVerified) {
    updates.ssl_status = "active";
    updates.verification_status = "verified";
    updates.is_active = true;
    updates.activated_at = new Date().toISOString();
  } else if (status.sslStatus === "pending_validation") {
    updates.ssl_status = "provisioning";
    updates.verification_status = "verifying";
  } else if (status.sslStatus === "validation_timed_out" || status.sslStatus === "blocked") {
    updates.ssl_status = "failed";
    updates.verification_status = "failed";
  }

  await db
    .from("website_domains")
    .update(updates)
    .eq("id", domainId);
}

/**
 * Returns the DNS records the tenant needs to configure for their domain.
 *
 * Apex domains (e.g. example.co.uk) cannot use CNAME at @ on most registrars,
 * so we instruct them to set A/AAAA records to the Fly anycast IPs instead.
 * www subdomains always use CNAME to the shared platform hostname.
 */
export function getDnsInstructions(domain: string, _verificationToken?: string): {
  records: Array<{ type: string; name: string; value: string; ttl: string; note?: string }>;
  advanced_records?: Array<{ type: string; name: string; value: string; ttl: string; note?: string }>;
  strategy?: "simple_cname" | "apex_advanced";
  /** @deprecated use records[] */
  cname: { type: string; name: string; value: string; ttl: string };
  /** @deprecated use records[] */
  www: { type: string; name: string; value: string; ttl: string };
} {
  const PLATFORM_DOMAIN = process.env.PLATFORM_CNAME_TARGET || "sites.tradeworkdesk.co.uk";
  // Fly anycast IPs — used for apex domains
  const FLY_APEX_IPV4 = "66.241.125.253";
  const FLY_APEX_IPV6 = "2a09:8280:1::139:7e95:0";

  const isApex = !domain.startsWith("www.");
  const apexDomain = domain.replace(/^www\./, "");

  const getSubdomainHostLabel = (fullDomain: string, apex: string): string => {
    if (fullDomain === apex) return "@";
    if (fullDomain.endsWith(`.${apex}`)) {
      return fullDomain.slice(0, -(apex.length + 1));
    }
    return fullDomain;
  };

  const hostLabel = getSubdomainHostLabel(domain, apexDomain);

  // Default to the simplest onboarding flow: one CNAME record.
  // Apex domains keep advanced records so existing setups still work.
  const simpleRecords = [
    {
      type: "CNAME",
      name: hostLabel === "@" ? "www" : hostLabel,
      value: PLATFORM_DOMAIN,
      ttl: "Auto",
      note: "Recommended: one-record setup",
    },
  ];

  const advancedRecords = isApex
    ? [
        { type: "A",     name: "@", value: FLY_APEX_IPV4, ttl: "Auto", note: "Advanced: point root domain directly to Fly" },
        { type: "AAAA",  name: "@", value: FLY_APEX_IPV6, ttl: "Auto", note: "Advanced: IPv6 for root domain" },
      ]
    : undefined;

  // Legacy shape (kept for backward compat with existing UI code)
  const legacyCname = isApex
    ? { type: "A",     name: "@",               value: FLY_APEX_IPV4,  ttl: "Auto" }
    : { type: "CNAME", name: domain,             value: PLATFORM_DOMAIN, ttl: "Auto" };
  const legacyWww   = { type: "CNAME", name: `www.${apexDomain}`, value: PLATFORM_DOMAIN, ttl: "Auto" };

  return {
    records: simpleRecords,
    advanced_records: advancedRecords,
    strategy: isApex ? "apex_advanced" : "simple_cname",
    cname: legacyCname,
    www: legacyWww,
  };
}
