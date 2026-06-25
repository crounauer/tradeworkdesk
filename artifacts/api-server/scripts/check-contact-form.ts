import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: website } = await db
    .from("websites")
    .select("id")
    .ilike("site_name", "%ecoheat%")
    .single();

  const { data: page } = await db
    .from("website_pages")
    .select("id")
    .eq("website_id", website.id)
    .eq("slug", "contact")
    .single();

  const { data: blocks } = await db
    .from("website_blocks")
    .select("*")
    .eq("page_id", page.id);

  console.log("Contact page blocks:");
  console.log(JSON.stringify(blocks, null, 2));
}

check().catch(console.error);
