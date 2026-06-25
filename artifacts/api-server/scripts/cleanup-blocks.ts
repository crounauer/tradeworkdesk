import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get all pages for North East Ecoheat LTD website
  const { data: website } = await supabase
    .from("websites")
    .select("id")
    .ilike("site_name", "%ecoheat%")
    .single();

  if (!website) {
    console.log("Website not found");
    return;
  }

  // Get all page IDs for this website
  const { data: pages } = await supabase
    .from("website_pages")
    .select("id, slug")
    .eq("website_id", website.id);

  if (!pages || pages.length === 0) {
    console.log("No pages found");
    return;
  }

  console.log(`Deleting blocks from ${pages.length} pages...`);

  // Delete all blocks for all pages
  for (const page of pages) {
    const { data, error } = await supabase
      .from("website_blocks")
      .delete()
      .eq("page_id", page.id);

    if (error) {
      console.error(`Error deleting blocks from ${page.slug}:`, error);
    } else {
      console.log(`✓ Deleted blocks from ${page.slug}`);
    }
  }

  console.log("Done!");
}

main().catch(console.error);
