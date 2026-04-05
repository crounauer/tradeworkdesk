import { supabaseAdmin } from "./supabase";

interface DefaultJobType {
  name: string;
  slug: string;
  category: "service" | "breakdown" | "installation" | "inspection" | "follow_up";
  color: string;
  default_duration_minutes: number;
  sort_order: number;
}

const DEFAULT_JOB_TYPES: DefaultJobType[] = [
  { name: "Annual Service", slug: "annual-service", category: "service", color: "#3B82F6", default_duration_minutes: 60, sort_order: 0 },
  { name: "Boiler Repair", slug: "boiler-repair", category: "breakdown", color: "#EF4444", default_duration_minutes: 90, sort_order: 1 },
  { name: "Gas Safety Certificate", slug: "gas-safety", category: "service", color: "#10B981", default_duration_minutes: 45, sort_order: 2 },
  { name: "New Installation", slug: "new-installation", category: "installation", color: "#8B5CF6", default_duration_minutes: 180, sort_order: 3 },
  { name: "Power Flush", slug: "power-flush", category: "service", color: "#F59E0B", default_duration_minutes: 120, sort_order: 4 },
  { name: "Emergency Call-Out", slug: "emergency-call-out", category: "breakdown", color: "#DC2626", default_duration_minutes: 60, sort_order: 5 },
  { name: "Follow-Up Visit", slug: "follow-up-visit", category: "follow_up", color: "#6B7280", default_duration_minutes: 45, sort_order: 6 },
  { name: "Inspection", slug: "inspection", category: "inspection", color: "#0EA5E9", default_duration_minutes: 60, sort_order: 7 },
];

export async function seedDefaultJobTypesForTenant(tenantId: string): Promise<void> {
  const { data: existing, error: checkError } = await supabaseAdmin
    .from("job_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);

  if (checkError) {
    console.error(`[job-types] Failed to check existing types for tenant ${tenantId}:`, checkError.message);
    return;
  }

  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabaseAdmin.from("job_types").insert(
    DEFAULT_JOB_TYPES.map((t) => ({
      tenant_id: tenantId,
      name: t.name,
      slug: t.slug,
      category: t.category,
      color: t.color,
      default_duration_minutes: t.default_duration_minutes,
      is_active: true,
      is_default: true,
      sort_order: t.sort_order,
    }))
  );

  if (insertError) {
    console.error(`[job-types] Failed to seed defaults for tenant ${tenantId}:`, insertError.message);
  }
}

export async function seedAllTenantsJobTypes(): Promise<void> {
  const { data: tenants, error } = await supabaseAdmin.from("tenants").select("id");
  if (error) {
    console.error("[job-types] Failed to fetch tenants for seeding:", error.message);
    return;
  }
  if (!tenants || tenants.length === 0) return;

  for (const tenant of tenants) {
    await seedDefaultJobTypesForTenant(tenant.id);
  }
  console.log(`[job-types] Seeded defaults for ${tenants.length} tenant(s)`);
}
