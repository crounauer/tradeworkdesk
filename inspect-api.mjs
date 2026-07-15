/**
 * Directly inspect what the API is returning
 */

async function inspectTemplate() {
  // Use Supabase to directly query the template record
  const url = new URL('http://localhost:3001/api/admin/website-templates/5b54470b-d8df-470a-bf3c-c564ac68fe2c');
  
  console.log('\n=== INSPECTING TEMPLATE ENDPOINT ===\n');
  console.log('Endpoint:', url.toString());
  console.log('Note: This will fail with auth error, but let\'s check the structure\n');
  
  try {
    const response = await fetch(url.toString());
    const data = await response.text();
    
    if (response.ok) {
      const json = JSON.parse(data);
      console.log('✅ Response OK');
      console.log('  pages array:', json.pages?.length || 0);
      console.log('  blocks array:', json.blocks?.length || 0);
      console.log('  template keys:', json.template ? Object.keys(json.template) : 'N/A');
      if (json.blocks && json.blocks.length > 0) {
        console.log('\n  First 5 blocks:');
        json.blocks.slice(0, 5).forEach((b, i) => {
          console.log(`    ${i}. ${b.block_type || 'unknown'}`);
        });
      } else {
        console.log('\n  ❌ Blocks array is empty!');
      }
    } else {
      console.log(`⚠️ Response ${response.status}:`, data.substring(0, 200));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

inspectTemplate();
