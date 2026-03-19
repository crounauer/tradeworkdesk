import { db } from "@workspace/db";
import { jobTypes } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  const existing = await db
    .select()
    .from(jobTypes)
    .where(eq(jobTypes.tenant_id, tenantId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(jobTypes).values(
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
}

export async function seedAllTenantsJobTypes(): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tenants } = await supabase.from("tenants").select("id");
  if (!tenants || tenants.length === 0) return;

  for (const tenant of tenants) {
    await seedDefaultJobTypesForTenant(tenant.id);
  }
  console.log(`[job-types] Seeded defaults for ${tenants.length} tenant(s)`);
}
