import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fix() {
  console.log("Finding ecoheat website...");
  const { data: websites } = await db
    .from("websites")
    .select("id, site_name")
    .ilike("site_name", "%ecoheat%");

  if (!websites?.length) {
    console.log("No website found");
    process.exit(1);
  }

  const websiteId = websites[0].id;
  console.log(`Found: ${websites[0].site_name}`);

  // Check current status
  const { data: before } = await db
    .from("website_pages")
    .select("slug, status")
    .eq("website_id", websiteId);

  console.log("Before:", before);

  // Publish all pages
  const { error } = await db
    .from("website_pages")
    .update({ status: "published" })
    .eq("website_id", websiteId);

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  // Verify
  const { data: after } = await db
    .from("website_pages")
    .select("slug, status")
    .eq("website_id", websiteId);

  console.log("After:", after);
  console.log("✅ Done");
}

fix().catch(console.error);
