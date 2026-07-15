import "dotenv/config";
import { supabaseAdmin } from "./src/lib/supabase";

const id = "2864b804-9e05-4911-b26d-7a66c04fdc71";

async function main() {
  const { count: pageCount } = await supabaseAdmin
    .from("website_template_pages")
    .select("id", { count: "exact", head: true })
    .eq("template_id", id);
  const { count: blockCount } = await supabaseAdmin
    .from("website_template_blocks")
    .select("id", { count: "exact", head: true })
    .eq("template_id", id);
  console.log({ pageCount, blockCount });

  const { data: sample } = await supabaseAdmin
    .from("website_template_blocks")
    .select("block_type,content")
    .eq("template_id", id)
    .eq("block_type", "hero.standard")
    .limit(3);
  console.log("hero rows", sample);
}

main().catch((e) => { console.error(e); process.exit(1); });
