import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fix() {
  // Find ecoheat website
  const { data: websites } = await db
    .from("websites")
    .select("id, site_name")
    .ilike("site_name", "%ecoheat%");

  if (!websites?.length) {
    console.log("No website found");
    return;
  }

  const website = websites[0];
  console.log(`Fixing website: ${website.site_name}\n`);

  // Get all pages
  const { data: pages } = await db
    .from("website_pages")
    .select("id, slug")
    .eq("website_id", website.id);

  if (!pages) return;

  const pagesBySlug = new Map(pages.map((p) => [p.slug, p.id]));

  // Fix home page: services_grid → services
  if (pagesBySlug.has("home")) {
    const { error } = await db
      .from("website_blocks")
      .update({ block_type: "services" })
      .eq("page_id", pagesBySlug.get("home"))
      .eq("block_type", "services_grid");
    if (error) console.error("Error home services_grid:", error);
    else console.log("✓ Fixed home: services_grid → services");
  }

  // Fix services page: services_grid → services
  if (pagesBySlug.has("services")) {
    const { error } = await db
      .from("website_blocks")
      .update({ block_type: "services" })
      .eq("page_id", pagesBySlug.get("services"))
      .eq("block_type", "services_grid");
    if (error) console.error("Error services page:", error);
    else console.log("✓ Fixed services page: services_grid → services");
  }

  // Delete map blocks from contact page
  if (pagesBySlug.has("contact")) {
    const { error } = await db
      .from("website_blocks")
      .delete()
      .eq("page_id", pagesBySlug.get("contact"))
      .eq("block_type", "map");
    if (error) console.error("Error deleting map:", error);
    else console.log("✓ Removed unsupported map block from contact");
  }

  console.log("\n✅ All fixes applied!");
}

fix().catch(console.error);
