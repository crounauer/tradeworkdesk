import "dotenv/config";
import { supabaseAdmin } from "./src/lib/supabase";

async function main() {
  const { data: templates, error } = await supabaseAdmin
    .from("website_templates")
    .select("id, slug, created_at, demo_pages, cms_mapping_json")
    .eq("slug", "local-plumbing-pro")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) throw error;
  for (const t of templates || []) {
    console.log("\nTEMPLATE", t.id, t.created_at);
    const demoPages = Array.isArray(t.demo_pages) ? t.demo_pages as Array<any> : [];
    const legal = demoPages.find((p) => p.slug === "legal");
    const p404 = demoPages.find((p) => p.slug === "404");
    console.log(" legal block_types:", legal?.block_types);
    console.log(" 404 block_types:", p404?.block_types);

    const cms = (t.cms_mapping_json as any) || {};
    const pageBlockProps = cms.pageBlockProps || {};
    console.log(" legal hero prop:", pageBlockProps?.legal?.["hero.standard"]?.title || null);
    console.log(" 404 hero prop:", pageBlockProps?.["404"]?.["hero.standard"]?.title || null);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
