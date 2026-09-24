import { supabaseAdmin } from "./supabase";

export async function isCompanyAccountEmail(tenantId: string, email: unknown): Promise<boolean> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return false;

  const [{ data: tenant }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("tenants").select("contact_email").eq("id", tenantId).maybeSingle(),
    supabaseAdmin.from("company_settings").select("email").eq("tenant_id", tenantId).eq("singleton_id", "default").maybeSingle(),
  ]);

  return [tenant?.contact_email, settings?.email]
    .some((value) => String(value || "").trim().toLowerCase() === normalizedEmail);
}

export async function isCompanyAccountEmailForAnyTenant(email: unknown): Promise<boolean> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return false;

  const [{ data: tenants }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("tenants").select("contact_email").ilike("contact_email", normalizedEmail),
    supabaseAdmin.from("company_settings").select("email").ilike("email", normalizedEmail),
  ]);

  const companyEmails = [
    ...(tenants || []).map((row) => row.contact_email),
    ...(settings || []).map((row) => row.email),
  ];
  return companyEmails.some((value) => String(value || "").trim().toLowerCase() === normalizedEmail);
}

export const COMPANY_ACCOUNT_EMAIL_ERROR =
  "This email address is used for the company account and cannot also be used for a customer record. Use a separate customer email address.";
