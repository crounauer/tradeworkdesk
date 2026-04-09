import type { AccountingProvider, AccountingIntegrationRow, AvailableProvider } from "./types";
import { ZohoInvoiceProvider } from "./zoho";
import { supabaseAdmin } from "../supabase";
import { decryptToken, encryptToken } from "./crypto";

const providerMeta: Map<string, { displayName: string; description: string }> = new Map([
  ["zoho_invoice", { displayName: "Zoho Invoice", description: "Send invoices directly to Zoho Invoice" }],
]);

export function getProvider(name: string): AccountingProvider | undefined {
  if (name === "zoho_invoice") return new ZohoInvoiceProvider();
  return undefined;
}

export function getProviderWithCredentials(name: string, clientId: string, clientSecret: string, dc?: string): AccountingProvider | undefined {
  if (name === "zoho_invoice") return new ZohoInvoiceProvider(clientId, clientSecret, dc);
  return undefined;
}

export async function getProviderForTenant(name: string, tenantId: string): Promise<AccountingProvider | undefined> {
  const { data: row } = await supabaseAdmin
    .from("accounting_integrations")
    .select("extra_config")
    .eq("tenant_id", tenantId)
    .eq("provider", name)
    .maybeSingle();

  const config = (row?.extra_config || {}) as Record<string, unknown>;
  const clientId = config.client_id ? decryptToken(config.client_id as string) : "";
  const clientSecret = config.client_secret ? decryptToken(config.client_secret as string) : "";

  const dc = (config.dc as string) || "uk";
  if (name === "zoho_invoice") return new ZohoInvoiceProvider(clientId, clientSecret, dc);
  return undefined;
}

export function getAllProviderInfo(): Array<{ key: string; displayName: string; description: string; status: "available" | "coming_soon" }> {
  const available = Array.from(providerMeta.entries()).map(([key, meta]) => ({
    key,
    displayName: meta.displayName,
    description: meta.description,
    status: "available" as const,
  }));

  const comingSoon = [
    { key: "xero", displayName: "Xero", description: "Cloud accounting for small businesses", status: "coming_soon" as const },
    { key: "quickbooks", displayName: "QuickBooks", description: "Accounting software by Intuit", status: "coming_soon" as const },
    { key: "sage", displayName: "Sage", description: "Business accounting & payroll", status: "coming_soon" as const },
    { key: "freeagent", displayName: "FreeAgent", description: "Accounting for freelancers & small businesses", status: "coming_soon" as const },
  ];

  return [...available, ...comingSoon];
}

export async function getActiveIntegration(tenantId: string): Promise<AccountingIntegrationRow | null> {
  const { data } = await supabaseAdmin
    .from("accounting_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .not("access_token", "is", null)
    .maybeSingle();
  return data as AccountingIntegrationRow | null;
}

export async function getIntegrationByProvider(tenantId: string, provider: string): Promise<AccountingIntegrationRow | null> {
  const { data } = await supabaseAdmin
    .from("accounting_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();
  return data as AccountingIntegrationRow | null;
}

export async function getAvailableProvidersWithStatus(tenantId: string): Promise<AvailableProvider[]> {
  const allInfo = getAllProviderInfo();

  const { data: integrations } = await supabaseAdmin
    .from("accounting_integrations")
    .select("*")
    .eq("tenant_id", tenantId);

  const intMap = new Map<string, AccountingIntegrationRow>();
  if (integrations) {
    for (const i of integrations) {
      intMap.set(i.provider, i as AccountingIntegrationRow);
    }
  }

  return allInfo.map((p) => {
    const integration = intMap.get(p.key);
    const config = (integration?.extra_config || {}) as Record<string, unknown>;
    const hasCreds = !!(config.client_id && config.client_secret);
    return {
      ...p,
      connected: !!(integration && integration.is_active && integration.access_token),
      has_credentials: hasCreds,
      organisation_id: integration?.organisation_id ?? null,
      connected_at: integration?.connected_at ?? null,
    };
  });
}

export async function ensureFreshToken(integration: AccountingIntegrationRow): Promise<string> {
  const config = (integration.extra_config || {}) as Record<string, unknown>;
  const clientId = config.client_id ? decryptToken(config.client_id as string) : "";
  const clientSecret = config.client_secret ? decryptToken(config.client_secret as string) : "";
  const dc = (config.dc as string) || "uk";
  const provider = getProviderWithCredentials(integration.provider, clientId, clientSecret, dc);
  if (!provider) throw new Error(`Unknown provider: ${integration.provider}`);

  const decryptedIntegration = {
    ...integration,
    access_token: integration.access_token ? decryptToken(integration.access_token) : null,
    refresh_token: integration.refresh_token ? decryptToken(integration.refresh_token) : null,
  };

  let refreshed: Awaited<ReturnType<typeof provider.refreshTokenIfNeeded>>;
  try {
    refreshed = await provider.refreshTokenIfNeeded(decryptedIntegration);
  } catch (err) {
    console.error(`[accounting] Token refresh failed for tenant integration ${integration.id}: ${(err as Error).message}`);
    if ((err as Error).message?.includes("invalid_code") || (err as Error).message?.includes("invalid_client")) {
      await supabaseAdmin
        .from("accounting_integrations")
        .update({
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    }
    throw new Error("Your accounting connection has expired. Please go to Company Settings → Accounting Integrations and click Connect to reconnect.");
  }

  if (!refreshed) {
    if (!decryptedIntegration.access_token) throw new Error("No access token available. Please reconnect your accounting integration in Company Settings.");
    return decryptedIntegration.access_token;
  }

  await supabaseAdmin
    .from("accounting_integrations")
    .update({
      access_token: encryptToken(refreshed.access_token),
      refresh_token: encryptToken(refreshed.refresh_token),
      token_expires_at: refreshed.token_expires_at.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  return refreshed.access_token;
}
