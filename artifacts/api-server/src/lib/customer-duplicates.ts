import type { SupabaseClient } from "@supabase/supabase-js";

type DatabaseClient = SupabaseClient<any, "public", any>;

export interface CustomerIdentity {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address_line1?: string | null;
  postcode?: string | null;
}

export interface MatchingCustomer extends Required<Pick<CustomerIdentity, "first_name" | "last_name">> {
  id: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_line1: string | null;
  postcode: string | null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string | null | undefined): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("44")) digits = `0${digits.slice(2)}`;
  return digits;
}

function normalizePostcode(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, "").toLocaleUpperCase();
}

function normalizeAddress(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export function customersHaveSameIdentity(existing: CustomerIdentity, candidate: CustomerIdentity): boolean {
  const email = normalizeText(candidate.email);
  if (email && email === normalizeText(existing.email)) return true;

  const sameName =
    normalizeText(existing.first_name) !== "" &&
    normalizeText(existing.last_name) !== "" &&
    normalizeText(existing.first_name) === normalizeText(candidate.first_name) &&
    normalizeText(existing.last_name) === normalizeText(candidate.last_name);
  if (!sameName) return false;

  const candidatePhone = normalizePhone(candidate.phone || candidate.mobile);
  const existingPhones = [normalizePhone(existing.phone), normalizePhone(existing.mobile)].filter(Boolean);
  if (candidatePhone && existingPhones.includes(candidatePhone)) return true;

  const postcode = normalizePostcode(candidate.postcode);
  if (postcode && postcode === normalizePostcode(existing.postcode)) return true;

  const address = normalizeAddress(candidate.address_line1);
  return Boolean(address && address === normalizeAddress(existing.address_line1));
}

export async function findMatchingCustomer(
  db: DatabaseClient,
  tenantId: string,
  candidate: CustomerIdentity,
): Promise<MatchingCustomer | null> {
  const fields = "id, first_name, last_name, email, phone, mobile, address_line1, postcode";
  const matches = new Map<string, MatchingCustomer>();

  const email = String(candidate.email || "").trim();
  if (email) {
    const { data, error } = await db.from("customers")
      .select(fields)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .ilike("email", email)
      .limit(10);
    if (error) throw new Error(`Customer duplicate check failed: ${error.message}`);
    for (const customer of (data || []) as MatchingCustomer[]) matches.set(customer.id, customer);
  }

  const phone = String(candidate.phone || candidate.mobile || "").trim();
  if (phone) {
    const { data, error } = await db.from("customers")
      .select(fields)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .or(`phone.eq.${phone},mobile.eq.${phone}`)
      .limit(10);
    if (error) throw new Error(`Customer duplicate check failed: ${error.message}`);
    for (const customer of (data || []) as MatchingCustomer[]) matches.set(customer.id, customer);
  }

  const lastName = String(candidate.last_name || "").trim();
  if (lastName && (phone || candidate.postcode || candidate.address_line1)) {
    const { data, error } = await db.from("customers")
      .select(fields)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .ilike("last_name", lastName)
      .limit(100);
    if (error) throw new Error(`Customer duplicate check failed: ${error.message}`);
    for (const customer of (data || []) as MatchingCustomer[]) matches.set(customer.id, customer);
  }

  return Array.from(matches.values()).find((customer) => customersHaveSameIdentity(customer, candidate)) || null;
}
