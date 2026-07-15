import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const templateId = '5b54470b-d8df-470a-bf3c-c564ac68fe2c';

console.log('\n=== DATABASE QUERY ===\n');

// Query the template to see what's stored
const { data, error } = await supabase
  .from('website_templates')
  .select('id, name, slug, status, demo_pages, design_tokens')
  .eq('id', templateId)
  .single();

if (error) {
  console.error('❌ Query error:', error);
} else {
  console.log('Template record:');
  console.log('  ID:', data.id);
  console.log('  Name:', data.name);
  console.log('  Slug:', data.slug);
  console.log('  Status:', data.status);
  console.log('  demo_pages type:', typeof data.demo_pages);
  console.log('  demo_pages is array:', Array.isArray(data.demo_pages));
  
  if (Array.isArray(data.demo_pages)) {
    console.log(`  demo_pages length: ${data.demo_pages.length}`);
    console.log('\n  Pages:');
    data.demo_pages.slice(0, 3).forEach(p => {
      console.log(`    - ${p.slug} (block_count: ${p.block_count}, block_types: ${p.block_types?.length || 0})`);
      if (p.block_types && p.block_types.length > 0) {
        console.log(`      Types: ${p.block_types.slice(0, 3).join(', ')}`);
      }
    });
  } else if (data.demo_pages) {
    console.log('  demo_pages value:', JSON.stringify(data.demo_pages, null, 2).substring(0, 300));
  }
}

console.log('\n=== END ===\n');
