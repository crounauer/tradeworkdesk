import type {
  AccountingProvider,
  AccountingTokens,
  AccountingContact,
  AccountingInvoiceInput,
  AccountingInvoiceResult,
  AccountingIntegrationRow,
} from "./types";

const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.eu";
const ZOHO_INVOICE_API = "https://www.zohoapis.eu/invoice/v3";

export class ZohoInvoiceProvider implements AccountingProvider {
  readonly name = "zoho_invoice";
  readonly displayName = "Zoho Invoice";

  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID || "";
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: "ZohoInvoice.invoices.CREATE,ZohoInvoice.contacts.CREATE,ZohoInvoice.contacts.READ,ZohoInvoice.settings.READ",
      redirect_uri: redirectUri,
      state,
      access_type: "offline",
      prompt: "consent",
    });
    return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<AccountingTokens> {
    const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    if (data.error) {
      throw new Error(`Zoho OAuth error: ${data.error}`);
    }

    const expiresIn = (data.expires_in as number) || 3600;

    const orgId = await this.fetchOrganisationId(data.access_token as string);

    return {
      access_token: data.access_token as string,
      refresh_token: data.refresh_token as string,
      token_expires_at: new Date(Date.now() + expiresIn * 1000),
      organisation_id: orgId,
    };
  }

  async refreshTokenIfNeeded(
    integration: AccountingIntegrationRow
  ): Promise<AccountingTokens | null> {
    if (!integration.token_expires_at || !integration.refresh_token) return null;

    const expiresAt = new Date(integration.token_expires_at).getTime();
    const buffer = 5 * 60 * 1000;
    if (Date.now() < expiresAt - buffer) return null;

    const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: integration.refresh_token,
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    if (data.error) {
      throw new Error(`Zoho token refresh error: ${data.error}`);
    }

    const expiresIn = (data.expires_in as number) || 3600;

    return {
      access_token: data.access_token as string,
      refresh_token: integration.refresh_token,
      token_expires_at: new Date(Date.now() + expiresIn * 1000),
      organisation_id: integration.organisation_id || undefined,
    };
  }

  async findOrCreateContact(
    accessToken: string,
    organisationId: string,
    contact: { name: string; email?: string; address?: string }
  ): Promise<AccountingContact> {
    const searchParams = new URLSearchParams({
      organization_id: organisationId,
      contact_name: contact.name,
    });

    const searchRes = await fetch(
      `${ZOHO_INVOICE_API}/contacts?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      }
    );

    const searchData = await searchRes.json() as { contacts?: Array<{ contact_id: string; contact_name: string; email?: string }> };

    if (searchData.contacts && searchData.contacts.length > 0) {
      const existing = searchData.contacts[0];
      return {
        id: existing.contact_id,
        name: existing.contact_name,
        email: existing.email,
      };
    }

    const createBody: Record<string, unknown> = {
      contact_name: contact.name,
    };
    if (contact.email) createBody.email = contact.email;
    if (contact.address) {
      createBody.billing_address = { address: contact.address };
    }

    const createRes = await fetch(
      `${ZOHO_INVOICE_API}/contacts?organization_id=${organisationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createBody),
      }
    );

    const createData = await createRes.json() as { contact?: { contact_id: string; contact_name: string; email?: string }; message?: string; code?: number };

    if (!createData.contact) {
      throw new Error(`Failed to create Zoho contact: ${createData.message || "Unknown error"}`);
    }

    return {
      id: createData.contact.contact_id,
      name: createData.contact.contact_name,
      email: createData.contact.email,
    };
  }

  async createInvoice(
    accessToken: string,
    organisationId: string,
    invoice: AccountingInvoiceInput
  ): Promise<AccountingInvoiceResult> {
    const lineItems = invoice.line_items.map((item) => ({
      name: item.description,
      description: item.description,
      quantity: item.quantity,
      rate: item.unit_price,
      tax_percentage: item.tax_percentage ?? 0,
    }));

    const body = {
      customer_id: invoice.contact_id,
      invoice_number: invoice.invoice_number,
      date: invoice.date,
      due_date: invoice.due_date,
      currency_code: invoice.currency,
      line_items: lineItems,
      notes: invoice.notes || "",
      reference_number: invoice.reference || "",
    };

    const res = await fetch(
      `${ZOHO_INVOICE_API}/invoices?organization_id=${organisationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json() as { invoice?: { invoice_id: string; invoice_number: string; status: string; invoice_url?: string }; message?: string; code?: number };

    if (!data.invoice) {
      throw new Error(`Failed to create Zoho invoice: ${data.message || "Unknown error"}`);
    }

    return {
      external_id: data.invoice.invoice_id,
      invoice_number: data.invoice.invoice_number,
      status: data.invoice.status,
      url: data.invoice.invoice_url,
    };
  }

  private async fetchOrganisationId(accessToken: string): Promise<string> {
    const res = await fetch(`${ZOHO_INVOICE_API}/organizations`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    const data = await res.json() as { organizations?: Array<{ organization_id: string; name: string; is_default_org?: boolean }> };

    if (!data.organizations || data.organizations.length === 0) {
      throw new Error("No Zoho organizations found");
    }

    const defaultOrg = data.organizations.find((o) => o.is_default_org);
    return (defaultOrg || data.organizations[0]).organization_id;
  }
}
