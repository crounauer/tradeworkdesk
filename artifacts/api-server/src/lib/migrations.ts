import { supabaseAdmin } from "./supabase";

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
}
