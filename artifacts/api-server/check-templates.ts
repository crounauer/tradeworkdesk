import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('\n=== PHASE 2 BLOCK GENERATION TEST ===\n');

// Get latest templates
const { data: templates } = await supabase
  .from('website_templates')
  .select('id, name, slug, status, demo_pages')
  .order('created_at', { ascending: false })
  .limit(3);

if (templates && templates.length > 0) {
  console.log(`📋 Latest templates:\n`);
  templates.forEach((t, i) => {
    const hasDemo = Array.isArray(t.demo_pages) && t.demo_pages.length > 0;
    const totalBlocks = hasDemo ? t.demo_pages.reduce((sum, p: any) => sum + (p.block_count || 0), 0) : 0;
    console.log(`${i + 1}. ${t.name} (${t.slug})`);
    console.log(`   demo_pages: ${hasDemo ? 'YES' : 'NO'} | Pages: ${hasDemo ? t.demo_pages.length : '?'} | Blocks: ${totalBlocks}`);
  });
}

console.log('\n✅ Done\n');
