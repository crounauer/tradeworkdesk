import type {
  AccountingProvider,
  AccountingTokens,
  AccountingContact,
  AccountingInvoiceInput,
  AccountingInvoiceResult,
  AccountingIntegrationRow,
} from "./types";

const ZOHO_DC_DOMAINS: Record<string, { accounts: string; api: string }> = {
  uk: { accounts: "https://accounts.zoho.uk", api: "https://www.zohoapis.eu/invoice/v3" },
  eu: { accounts: "https://accounts.zoho.eu", api: "https://www.zohoapis.eu/invoice/v3" },
  com: { accounts: "https://accounts.zoho.com", api: "https://www.zohoapis.com/invoice/v3" },
  in: { accounts: "https://accounts.zoho.in", api: "https://www.zohoapis.in/invoice/v3" },
  au: { accounts: "https://accounts.zoho.com.au", api: "https://www.zohoapis.com.au/invoice/v3" },
  jp: { accounts: "https://accounts.zoho.jp", api: "https://www.zohoapis.jp/invoice/v3" },
};

export class ZohoInvoiceProvider implements AccountingProvider {
  readonly name = "zoho_invoice";
  readonly displayName = "Zoho Invoice";

  private clientId: string;
  private clientSecret: string;
  private dc: string;

  constructor(clientId?: string, clientSecret?: string, dc?: string) {
    this.clientId = clientId || "";
    this.clientSecret = clientSecret || "";
    this.dc = dc || "uk";
  }

  private get domains() {
    return ZOHO_DC_DOMAINS[this.dc] || ZOHO_DC_DOMAINS["uk"];
  }

  setCredentials(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  hasCredentials(): boolean {
    return !!(this.clientId && this.clientSecret);
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
    return `${this.domains.accounts}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<AccountingTokens> {
    const res = await fetch(`${this.domains.accounts}/oauth/v2/token`, {
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

    const res = await fetch(`${this.domains.accounts}/oauth/v2/token`, {
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
    contact: {
      name: string;
      email?: string;
      phone?: string;
      mobile?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      county?: string;
      postcode?: string;
      address?: string;
    }
  ): Promise<AccountingContact> {
    const searchParams = new URLSearchParams({
      organization_id: organisationId,
      contact_name: contact.name,
    });

    const searchRes = await fetch(
      `${this.domains.api}/contacts?${searchParams.toString()}`,
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

    const billingAddress: Record<string, string> = {};
    if (contact.address_line1) billingAddress.street = contact.address_line1;
    if (contact.address_line2) billingAddress.street2 = contact.address_line2;
    if (contact.city) billingAddress.city = contact.city;
    if (contact.county) billingAddress.state = contact.county;
    if (contact.postcode) billingAddress.zip = contact.postcode;
    billingAddress.country = "United Kingdom";

    const createBody: Record<string, unknown> = {
      contact_name: contact.name,
      contact_type: "customer",
    };
    if (contact.email) createBody.email = contact.email;
    if (contact.phone) createBody.phone = contact.phone;
    if (contact.mobile) createBody.mobile = contact.mobile;
    if (Object.keys(billingAddress).length > 1) {
      createBody.billing_address = billingAddress;
    }

    const createRes = await fetch(
      `${this.domains.api}/contacts?organization_id=${organisationId}`,
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

    const body: Record<string, unknown> = {
      customer_id: invoice.contact_id,
      date: invoice.date,
      due_date: invoice.due_date,
      currency_code: invoice.currency,
      line_items: lineItems,
      notes: invoice.notes || "",
      reference_number: invoice.reference || "",
    };

    const res = await fetch(
      `${this.domains.api}/invoices?organization_id=${organisationId}`,
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
    const res = await fetch(`${this.domains.api}/organizations`, {
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
