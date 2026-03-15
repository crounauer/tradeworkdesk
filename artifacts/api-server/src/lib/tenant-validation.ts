import { supabaseAdmin } from "./supabase";

export async function verifyTenantOwnership(
  table: string,
  id: string,
  tenantId: string | undefined
): Promise<boolean> {
  if (!tenantId) return true;
  if (!id) return false;

  const { data } = await supabaseAdmin
    .from(table)
    .select("tenant_id")
    .eq("id", id)
    .single();

  if (!data) return false;
  return data.tenant_id === tenantId;
}

export async function verifyMultipleTenantOwnership(
  checks: Array<{ table: string; id: string | undefined | null }>
, tenantId: string | undefined
): Promise<{ valid: boolean; failedTable?: string }> {
  if (!tenantId) return { valid: true };

  for (const check of checks) {
    if (!check.id) continue;
    const valid = await verifyTenantOwnership(check.table, check.id, tenantId);
    if (!valid) return { valid: false, failedTable: check.table };
  }

  return { valid: true };
}
