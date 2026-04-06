export interface AccountingContact {
  id: string;
  name: string;
  email?: string;
}

export interface AccountingInvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_percentage?: number;
}

export interface AccountingInvoiceInput {
  contact_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  currency: string;
  line_items: AccountingInvoiceLineItem[];
  notes?: string;
  reference?: string;
}

export interface AccountingInvoiceResult {
  external_id: string;
  invoice_number: string;
  status: string;
  url?: string;
}

export interface AccountingTokens {
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  organisation_id?: string;
  extra_config?: Record<string, unknown>;
}

export interface AccountingProvider {
  readonly name: string;
  readonly displayName: string;

  getAuthUrl(redirectUri: string, state: string): string;

  exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<AccountingTokens>;

  refreshTokenIfNeeded(
    integration: AccountingIntegrationRow
  ): Promise<AccountingTokens | null>;

  findOrCreateContact(
    accessToken: string,
    organisationId: string,
    contact: { name: string; email?: string; address?: string }
  ): Promise<AccountingContact>;

  createInvoice(
    accessToken: string,
    organisationId: string,
    invoice: AccountingInvoiceInput
  ): Promise<AccountingInvoiceResult>;
}

export interface AccountingIntegrationRow {
  id: string;
  tenant_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  organisation_id: string | null;
  extra_config: Record<string, unknown> | null;
  connected_at: string | null;
  is_active: boolean;
}

export interface AvailableProvider {
  key: string;
  displayName: string;
  description: string;
  status: "available" | "coming_soon";
  connected: boolean;
  organisation_id?: string | null;
  connected_at?: string | null;
}
