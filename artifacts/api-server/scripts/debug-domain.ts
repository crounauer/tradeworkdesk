import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase config");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking website_domains table...\n");

  const { data: domains, error: domainError } = await db
    .from("website_domains")
    .select("id, domain, website_id, is_active")
    .like("domain", "%ecoheat%");

  if (domainError) {
    console.error("Error fetching domains:", domainError);
  } else {
    console.log("Domains matching 'ecoheat':");
    console.log(JSON.stringify(domains, null, 2));
  }

  console.log("\n\nChecking websites table...\n");

  const { data: websites, error: websiteError } = await db
    .from("websites")
    .select("id, site_name, status")
    .like("site_name", "%Eco%");

  if (websiteError) {
    console.error("Error fetching websites:", websiteError);
  } else {
    console.log("Websites matching 'Eco':");
    console.log(JSON.stringify(websites, null, 2));
  }
}

main().catch(console.error);
