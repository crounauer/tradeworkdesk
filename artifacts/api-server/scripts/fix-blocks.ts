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

  // Fix services_grid → services
  const { error: e1 } = await db
    .from("website_blocks")
    .update({ block_type: "services" })
    .eq("website_id", website.id)
    .eq("block_type", "services_grid");
  if (e1) console.error("Error updating services_grid:", e1);
  else console.log("✓ Fixed services_grid → services");

  // Fix features → process (for how-it-works page only)
  const { data: howitworksPages } = await db
    .from("website_pages")
    .select("id")
    .eq("website_id", website.id)
    .eq("slug", "how-it-works");

  if (howitworksPages?.length) {
    const { error: e2 } = await db
      .from("website_blocks")
      .update({ block_type: "process" })
      .eq("page_id", howitworksPages[0].id)
      .eq("block_type", "features");
    if (e2) console.error("Error updating features:", e2);
    else console.log("✓ Fixed features → process (how-it-works page)");
  }

  // Delete map blocks (unsupported)
  const { error: e3 } = await db
    .from("website_blocks")
    .delete()
    .eq("website_id", website.id)
    .eq("block_type", "map");
  if (e3) console.error("Error deleting map:", e3);
  else console.log("✓ Removed unsupported map blocks");

  // Fix areas-we-cover: services_grid → areas
  const { data: areasPages } = await db
    .from("website_pages")
    .select("id")
    .eq("website_id", website.id)
    .eq("slug", "areas-we-cover");

  if (areasPages?.length) {
    const { error: e4 } = await db
      .from("website_blocks")
      .update({ block_type: "areas" })
      .eq("page_id", areasPages[0].id)
      .eq("block_type", "services_grid");
    if (e4) console.error("Error updating areas:", e4);
    else console.log("✓ Fixed areas-we-cover: services_grid → areas");
  }

  console.log("\n✅ All block types fixed!");
}

fix().catch(console.error);
