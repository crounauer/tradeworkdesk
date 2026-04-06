import type { AccountingProvider, AccountingIntegrationRow, AvailableProvider } from "./types";
import { ZohoInvoiceProvider } from "./zoho";
import { supabaseAdmin } from "../supabase";
import { decryptToken, encryptToken } from "./crypto";

const providers: Map<string, AccountingProvider> = new Map();

function ensureProviders() {
  if (providers.size > 0) return;
  const zoho = new ZohoInvoiceProvider();
  providers.set(zoho.name, zoho);
}

export function getProvider(name: string): AccountingProvider | undefined {
  ensureProviders();
  return providers.get(name);
}

export function getAllProviderInfo(): Array<{ key: string; displayName: string; description: string; status: "available" | "coming_soon" }> {
  ensureProviders();

  const available = Array.from(providers.values()).map((p) => ({
    key: p.name,
    displayName: p.displayName,
    description: getProviderDescription(p.name),
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
    return {
      ...p,
      connected: !!(integration && integration.is_active),
      organisation_id: integration?.organisation_id ?? null,
      connected_at: integration?.connected_at ?? null,
    };
  });
}

export async function ensureFreshToken(integration: AccountingIntegrationRow): Promise<string> {
  ensureProviders();
  const provider = providers.get(integration.provider);
  if (!provider) throw new Error(`Unknown provider: ${integration.provider}`);

  const decryptedIntegration = {
    ...integration,
    access_token: integration.access_token ? decryptToken(integration.access_token) : null,
    refresh_token: integration.refresh_token ? decryptToken(integration.refresh_token) : null,
  };

  const refreshed = await provider.refreshTokenIfNeeded(decryptedIntegration);
  if (!refreshed) {
    if (!decryptedIntegration.access_token) throw new Error("No access token available");
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

function getProviderDescription(key: string): string {
  switch (key) {
    case "zoho_invoice":
      return "Send invoices directly to Zoho Invoice";
    default:
      return "";
  }
}
