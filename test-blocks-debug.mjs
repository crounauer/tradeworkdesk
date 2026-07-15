const API_BASE = 'http://localhost:3001/api';
const TEST_ID = '5b54470b-d8df-470a-bf3c-c564ac68fe2c';

async function testBlocksAPI() {
  console.log('\n=== API BLOCKS DEBUG TEST ===\n');
  
  try {
    console.log(`Testing template: ${TEST_ID}`);
    
    const detailResp = await fetch(`${API_BASE}/admin/website-templates/${TEST_ID}`);
    console.log(`Response status: ${detailResp.status}`);
    
    if (detailResp.ok) {
      const detail = await detailResp.json();
      console.log(`\n📋 Response:`);
      console.log(`  - Pages: ${detail.pages?.length || 0}`);
      console.log(`  - Blocks: ${detail.blocks?.length || 0}`);
      
      if (detail.pages && detail.pages.length > 0) {
        console.log(`\n✅ Pages (${detail.pages.length}):`);
        detail.pages.slice(0, 3).forEach(p => {
          console.log(`   - ${p.slug} (${p.block_count || 0} blocks expected)`);
        });
      }
      
      if (detail.blocks && detail.blocks.length > 0) {
        console.log(`\n✅ BLOCKS FOUND: ${detail.blocks.length}`);
        console.log('First 5:');
        detail.blocks.slice(0, 5).forEach((b, i) => {
          console.log(`  ${i + 1}. ${b.block_type} (page: ${b.page_id})`);
        });
      } else {
        console.log('\n❌ NO BLOCKS FOUND IN RESPONSE');
      }
    } else {
      const errorText = await detailResp.text();
      console.error(`❌ Failed: ${errorText.substring(0, 200)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n=== END ===\n');
}

testBlocksAPI();
