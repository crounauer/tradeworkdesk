import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: websites } = await supabase
    .from("websites")
    .select("id, name, subdomain")
    .limit(5);

  console.log("Websites in database:");
  console.log(JSON.stringify(websites, null, 2));
}

main().catch(console.error);
