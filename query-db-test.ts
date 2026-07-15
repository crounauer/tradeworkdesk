import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const templateId = '5b54470b-d8df-470a-bf3c-c564ac68fe2c';

console.log('\n=== DATABASE QUERY ===\n');

// Query the template
const { data, error } = await supabase
  .from('website_templates')
  .select('id, name, slug, status, demo_pages, design_tokens')
  .eq('id', templateId)
  .single();

if (error) {
  console.error('❌ Query error:', error);
} else {
  console.log('Template found:');
  console.log('  ID:', data.id);
  console.log('  Name:', data.name);
  console.log('  demo_pages type:', typeof data.demo_pages);
  console.log('  demo_pages is array:', Array.isArray(data.demo_pages));
  
  if (Array.isArray(data.demo_pages)) {
    console.log(`  demo_pages length: ${data.demo_pages.length}`);
    console.log('\nFirst 3 pages:');
    (data.demo_pages as any[]).slice(0, 3).forEach(p => {
      console.log(`  - ${p.slug}: ${p.block_count} blocks, types: ${p.block_types?.length || 0}`);
    });
  } else {
    console.log('  demo_pages:', data.demo_pages);
  }
}
