import { supabaseAdmin } from "../src/lib/supabase";

const db = supabaseAdmin as any;

async function fix() {
  // Find the ecoheat website
  const { data: websites } = await db
    .from("websites")
    .select("id, site_name")
    .ilike("site_name", "%ecoheat%");

  if (!websites || websites.length === 0) {
    console.error("No website found");
    process.exit(1);
  }

  const website = websites[0];
  console.log(`Found website: ${website.site_name} (${website.id})`);

  // Get current pages
  const { data: pages } = await db
    .from("website_pages")
    .select("id, slug, status")
    .eq("website_id", website.id);

  console.log("Current pages:", pages);

  // Update all pages to published
  const { error } = await db
    .from("website_pages")
    .update({ status: "published" })
    .eq("website_id", website.id);

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  // Verify
  const { data: updatedPages } = await db
    .from("website_pages")
    .select("id, slug, status")
    .eq("website_id", website.id);

  console.log("Updated pages:", updatedPages);
  console.log("✅ Done");
}

fix().catch(console.error);
