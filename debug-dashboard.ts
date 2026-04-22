// Debug script to check dashboard data
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fatkjtkvtebkxgeqtoaj.supabase.co";
const SERVICE_ROLE_KEY =
  "sb_secret_nA3499y_uPeemvHKMPj4mQ_qEYcXe5j";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkDatabase() {
  console.log("\n=== DASHBOARD DATA DEBUG ===\n");

  // Check jobs
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .limit(5);
  console.log("JOBS COUNT:", jobs?.length);
  console.log("JOBS ERROR:", jobsError);
  if (jobs?.length === 0) {
    console.log("⚠️ NO JOBS FOUND - This is why dashboard is empty!");
  }

  // Check customers
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("*")
    .limit(5);
  console.log("\nCUSTOMERS COUNT:", customers?.length);
  console.log("CUSTOMERS ERROR:", customersError);

  // Check properties
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("*")
    .limit(5);
  console.log("\nPROPERTIES COUNT:", properties?.length);
  console.log("PROPERTIES ERROR:", propertiesError);

  // Check appliances
  const { data: appliances, error: appliancesError } = await supabase
    .from("appliances")
    .select("*")
    .limit(5);
  console.log("\nAPPLIANCES COUNT:", appliances?.length);
  console.log("APPLIANCES ERROR:", appliancesError);

  // Check profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .limit(5);
  console.log("\nPROFILES COUNT:", profiles?.length);
  console.log("PROFILES ERROR:", profilesError);

  // Check tenants
  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("*")
    .limit(5);
  console.log("\nTENANTS COUNT:", tenants?.length);
  console.log("TENANTS ERROR:", tenantsError);

  // Check why seed data not loaded
  console.log("\n=== SEED DATA STATUS ===");
  console.log("seed.sql has jobs commented out: YES");
  console.log("Need to:");
  console.log("1. Create auth user");
  console.log("2. Create profile for that user");
  console.log("3. Uncomment and run job seeds");
}

checkDatabase().catch(console.error);
