import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
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
  console.log(`Website: ${website.site_name}\n`);

  const { data: pages } = await db
    .from("website_pages")
    .select("id, slug, status")
    .eq("website_id", website.id)
    .order("nav_order");

  if (!pages) return;

  for (const page of pages) {
    const { data: blocks } = await db
      .from("website_blocks")
      .select("id, block_type, is_visible")
      .eq("page_id", page.id);

    console.log(`${page.slug}: ${blocks?.length || 0} blocks (status: ${page.status})`);
    blocks?.forEach((b) => console.log(`  - ${b.block_type} (visible: ${b.is_visible})`));
  }
}

check().catch(console.error);
