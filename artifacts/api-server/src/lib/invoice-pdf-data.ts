import { supabaseAdmin } from "./supabase";
import type { InvoicePdfData } from "./invoice-pdf";
import { getQuoteAdditionalText } from "./quote-terms";

// Share the short-lived settings cache across invoice list, send and PDF operations.
const settingsCache = new Map<string, { data: Record<string, unknown> | null; ts: number }>();
const SETTINGS_TTL_MS = 30_000;

export async function getCompanySettings(tenantId: string, strict = false) {
  const cached = settingsCache.get(tenantId);
  if (cached && Date.now() - cached.ts < SETTINGS_TTL_MS) return cached.data;
  const { data, error } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();
  if (error) {
    if (strict) throw new Error(`Failed to load company settings: ${error.message}`);
    return data;
  }
  settingsCache.set(tenantId, { data: data as Record<string, unknown> | null, ts: Date.now() });
  return data;
}

export function normalizePositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

export function resolveDateFromIssue(issueDate: string | null | undefined, dayOffset: number | null): string | null {
  if (!issueDate || !dayOffset || dayOffset <= 0) return null;
  const base = new Date(issueDate);
  if (isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString().slice(0, 10);
}

export function getCustomerDisplayName(
  customer: { business_name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined,
  fallback = "Customer",
): string {
  const business = String(customer?.business_name || "").trim();
  if (business) return business;
  const fullName = `${String(customer?.first_name || "")} ${String(customer?.last_name || "")}`.trim();
  return fullName || fallback;
}

export async function buildPdfData(
  invoice: Record<string, unknown>,
  lineItems: Record<string, unknown>[],
  tenantId: string,
  strict = false,
): Promise<InvoicePdfData> {
  const settings = await getCompanySettings(tenantId, strict);

  // Load customer
  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("business_name, first_name, last_name, email, phone, mobile, address_line1, address_line2, city, county, postcode")
    .eq("id", invoice.customer_id as string)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (strict && customerError) throw new Error(`Failed to load invoice customer: ${customerError.message}`);

  const customerName = getCustomerDisplayName(customer, "Unknown Customer");
  const isQuote = (invoice.type as string) === "quote";
  const paymentTermsDays = normalizePositiveInt(settings?.default_payment_terms_days);
  const quoteValidityDays = normalizePositiveInt(settings?.quote_validity_days) ?? 30;
  const resolvedDueDate = !isQuote
    ? resolveDateFromIssue(invoice.issue_date as string | null, paymentTermsDays)
    : (invoice.due_date as string | null);
  const resolvedExpiryDate = isQuote
    ? (resolveDateFromIssue(invoice.issue_date as string | null, quoteValidityDays) || (invoice.expiry_date as string | null))
    : (invoice.expiry_date as string | null);
  const invoiceFooterText = (settings?.invoice_footer_text as string | null) || null;
  const quoteFooterText = (settings?.quote_footer_text as string | null) || null;
  const invoiceAdditionalText = (settings?.invoice_additional_text as string | null) || null;
  const quoteAdditionalText = getQuoteAdditionalText(settings?.quote_additional_text, paymentTermsDays);
  const showBankDetails = isQuote
    ? (settings?.show_bank_details_on_quotes as boolean | null) !== false
    : (settings?.show_bank_details_on_invoices as boolean | null) !== false;
  const showRatesUrl = isQuote
    ? (settings?.show_rates_url_on_quotes as boolean | null) !== false
    : (settings?.show_rates_url_on_invoices as boolean | null) !== false;
  const showTradingTermsUrl = isQuote
    ? (settings?.show_trading_terms_url_on_quotes as boolean | null) !== false
    : (settings?.show_trading_terms_url_on_invoices as boolean | null) !== false;

  // Load job for human-readable ref and property_id
  const { data: job, error: jobError } = invoice.job_id
    ? await supabaseAdmin
        .from("jobs")
        .select("job_ref, property_id, description")
        .eq("id", invoice.job_id as string)
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : { data: null, error: null };
  if (strict && jobError) throw new Error(`Failed to load invoice job: ${jobError.message}`);

  // Load property address: used as billing fallback and as service address when it differs
  const { data: property, error: propertyError } = (job?.property_id || invoice.property_id)
    ? await supabaseAdmin
        .from("properties")
        .select("id, address_line1, address_line2, city, county, postcode")
        .eq("id", (job?.property_id || invoice.property_id) as string)
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : { data: null, error: null };
  if (strict && propertyError) throw new Error(`Failed to load invoice property: ${propertyError.message}`);

  // Include service address when the work location differs from the customer's billing address
  const billingPostcode = (customer?.postcode || "").trim().toUpperCase().replace(/\s+/g, "");
  const propertyPostcode = (property?.postcode || "").trim().toUpperCase().replace(/\s+/g, "");
  const showWorkAddress = !!(property?.address_line1 && propertyPostcode && propertyPostcode !== billingPostcode);

  return {
    type: invoice.type as "invoice" | "quote",
    invoice_number: invoice.invoice_number as string,
    issue_date: invoice.issue_date as string,
    due_date: resolvedDueDate,
    expiry_date: resolvedExpiryDate,
    payment_terms_days: paymentTermsDays,
    quote_validity_days: quoteValidityDays,
    currency: (invoice.currency as string) || settings?.currency || "GBP",
    // Company
    company_name: settings?.name,
    company_trading_name: settings?.trading_name,
    company_address_line1: settings?.address_line1,
    company_address_line2: settings?.address_line2,
    company_city: settings?.city,
    company_county: settings?.county,
    company_postcode: settings?.postcode,
    company_phone: settings?.phone,
    company_email: settings?.email,
    company_website: settings?.website,
    company_vat_number: settings?.vat_number,
    company_gas_safe_number: settings?.gas_safe_number,
    company_oftec_number: settings?.oftec_number,
    company_logo_url: settings?.logo_url,
    company_footer_text: isQuote ? (quoteFooterText || invoiceFooterText) : invoiceFooterText,
    company_bank_details: showBankDetails ? (settings?.invoice_bank_details as string | null) : null,
    company_additional_text: isQuote ? quoteAdditionalText : invoiceAdditionalText,
    company_rates_url: showRatesUrl ? (settings?.rates_url as string | null) : null,
    company_trading_terms_url: showTradingTermsUrl ? (settings?.trading_terms_url as string | null) : null,
    // Customer
    customer_name: customerName,
    customer_address_line1: customer?.address_line1 || property?.address_line1,
    customer_address_line2: customer?.address_line2 || property?.address_line2,
    customer_city: customer?.city || property?.city,
    customer_county: customer?.county || property?.county,
    customer_postcode: customer?.postcode || property?.postcode,
    customer_email: customer?.email,
    customer_phone: customer?.phone || customer?.mobile,
    work_address_line1: showWorkAddress ? property!.address_line1 : null,
    work_address_line2: showWorkAddress ? property!.address_line2 : null,
    work_address_city: showWorkAddress ? property!.city : null,
    work_address_county: showWorkAddress ? property!.county : null,
    work_address_postcode: showWorkAddress ? property!.postcode : null,
    // Job
    job_reference: (job?.job_ref as string | null) || null,
    job_description: (job?.description as string | null) || null,
    // Line items
    line_items: lineItems.map((l) => ({
      description: l.description as string,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      total: Number(l.total),
      item_type: l.item_type as string,
    })),
    subtotal: Number(invoice.subtotal),
    discount_type: invoice.discount_type === "percentage" || invoice.discount_type === "fixed" ? invoice.discount_type : null,
    discount_value: Number(invoice.discount_value ?? 0),
    discount_amount: Number(invoice.discount_amount ?? 0),
    vat_rate: Number(invoice.vat_rate),
    vat_amount: Number(invoice.vat_amount),
    total: Number(invoice.total),
    amount_paid: Math.round(Number(invoice.paid_amount ?? 0) * 100) / 100,
    balance_due: Math.max(0, Math.round((Number(invoice.total ?? 0) - Number(invoice.paid_amount ?? 0)) * 100) / 100),
    works_order: invoice.works_order as string | null,
    customer_notes: invoice.customer_notes as string | null,
    estimated_duration_value: invoice.estimated_duration_value != null ? Number(invoice.estimated_duration_value) : null,
    estimated_duration_unit: invoice.estimated_duration_unit as "hours" | "days" | null,
  };
}
