import { supabaseAdmin } from "./supabase";

const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";

async function ensureFreePlan() {
  const { data } = await supabaseAdmin
    .from("plans")
    .select("id")
    .eq("id", FREE_PLAN_ID)
    .maybeSingle();

  if (!data) {
    const { error } = await supabaseAdmin.from("plans").insert({
      id: FREE_PLAN_ID,
      name: "Free",
      description: "Free forever plan with basic job management",
      monthly_price: 0,
      annual_price: 0,
      max_users: 1,
      max_jobs_per_month: 5,
      sort_order: 0,
      features: {
        job_management: true,
        scheduling: true,
        heat_pump_forms: false,
        combustion_analysis: false,
        reports: false,
        api_access: false,
        invoicing: false,
        team_management: false,
        social_media: false,
        oil_tank_forms: false,
        commissioning_forms: false,
        custom_branding: false,
        priority_support: false,
      },
    });
    if (error) {
      console.error("[migrations] Failed to insert Free plan:", error.message);
    } else {
      console.log("[migrations] Free plan seeded successfully.");
    }
  }
}

export async function runStartupMigrations() {
  const needed: string[] = [];

  const { error: e1 } = await supabaseAdmin
    .from("company_settings")
    .select("job_number_prefix")
    .limit(1);
  if (e1) needed.push("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS job_number_prefix varchar(10) DEFAULT NULL;");

  const { error: e2 } = await supabaseAdmin
    .from("company_settings")
    .select("job_number_next")
    .limit(1);
  if (e2) needed.push("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS job_number_next integer DEFAULT 1;");

  const { error: e3 } = await supabaseAdmin
    .from("jobs")
    .select("job_ref")
    .limit(1);
  if (e3) needed.push("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_ref varchar(20) DEFAULT NULL;");

  if (needed.length > 0) {
    console.warn("[migrations] Run this SQL in the Supabase SQL Editor:");
    console.warn(needed.join("\n"));
  } else {
    console.log("[migrations] All columns present.");
  }

  await ensureFreePlan();
}
