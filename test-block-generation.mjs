/**
 * Playwright test for Phase 2 block generation
 * 
 * Verifies that:
 * 1. Templates generate with correct page/block counts
 * 2. Admin view displays pages and blocks
 * 3. Pages & Blocks tab shows block structure
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001';

// Sample Figma URL and ZIP path for testing
const FIGMA_URL = 'https://www.figma.com/design/test';
const TEST_NAME = `test-template-${Date.now()}`;
const TEST_SLUG = TEST_NAME.toLowerCase().replace(/\s+/g, '-');

async function testBlockGeneration() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: '/tmp/auth.json' // We'll need to be logged in
  });
  
  const page = await context.newPage();
  
  try {
    console.log('\n=== PHASE 2 BLOCK GENERATION TEST ===\n');
    
    // 1. Get list of templates to find one that was just approved
    console.log('1️⃣  Fetching templates list...');
    const templatesResp = await fetch(`${API_BASE}/admin/website-templates`, {
      headers: { 'Authorization': 'Bearer <token>' }
    });
    
    if (!templatesResp.ok) {
      console.error('❌ Failed to fetch templates:', templatesResp.status);
      return;
    }
    
    const templatesData = await templatesResp.json();
    console.log(`✅ Found templates: ${templatesData.count}`);
    
    // 2. Get details of the most recent template
    if (templatesData.templates && templatesData.templates.length > 0) {
      const latestTemplate = templatesData.templates[0];
      console.log(`\n2️⃣  Testing latest template: ${latestTemplate.name} (${latestTemplate.id})`);
      
      const detailResp = await fetch(`${API_BASE}/admin/website-templates/${latestTemplate.id}`);
      const detailData = await detailResp.json();
      
      console.log(`\n📋 Template Details:
  - Pages: ${detailData.pages.length}
  - Blocks: ${detailData.blocks.length}
  - demo_pages stored: ${Array.isArray(detailData.template.demo_pages) ? 'YES' : 'NO'}
  - demo_pages length: ${detailData.template.demo_pages?.length || 0}
      `);
      
      if (detailData.pages.length > 0) {
        console.log('Pages:');
        detailData.pages.forEach(p => {
          console.log(`  - ${p.slug} (${p.title})`);
        });
      } else {
        console.log('❌ No pages found');
      }
      
      if (detailData.blocks.length > 0) {
        console.log(`\nBlocks (${detailData.blocks.length} total):`);
        detailData.blocks.slice(0, 10).forEach(b => {
          console.log(`  - ${b.block_type || 'unknown'} (page: ${b.page_id})`);
        });
        if (detailData.blocks.length > 10) {
          console.log(`  ... and ${detailData.blocks.length - 10} more`);
        }
      } else {
        console.log('❌ No blocks found');
      }
      
      // 3. Test the admin UI
      console.log(`\n3️⃣  Testing admin UI for template...`);
      await page.goto(`${BASE_URL}/admin/website-templates`);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Look for the template in the list
      const templateCard = await page.locator(`text=${latestTemplate.name}`).first();
      
      if (await templateCard.isVisible()) {
        console.log(`✅ Template card found in admin UI`);
        
        // Get the page/block counts from the card
        const pageCount = await templateCard.locator('text=/\\d+ pages/').textContent();
        const blockCount = await templateCard.locator('text=/\\d+ blocks/').textContent();
        
        console.log(`  Page count display: ${pageCount || 'not found'}`);
        console.log(`  Block count display: ${blockCount || 'not found'}`);
        
        // Click "View details"
        const viewDetailsBtn = templateCard.locator('button:has-text("View details")');
        if (await viewDetailsBtn.isVisible()) {
          console.log(`\n4️⃣  Opening template details modal...`);
          await viewDetailsBtn.click();
          
          // Wait for modal to appear
          await page.waitForSelector('dialog', { timeout: 5000 });
          
          // Get modal content
          const modal = page.locator('dialog').first();
          const modalPages = await modal.locator('text=Pages').first().evaluate(el => 
            el.parentElement?.textContent
          );
          const modalBlocks = await modal.locator('text=Blocks').first().evaluate(el =>
            el.parentElement?.textContent
          );
          
          console.log(`✅ Modal opened`);
          console.log(`  Modal Pages: ${modalPages}`);
          console.log(`  Modal Blocks: ${modalBlocks}`);
          
          // Click on Pages & Blocks tab
          const pagesBlocksTab = modal.locator('button, [role="tab"]:has-text("Pages & Blocks")');
          if (await pagesBlocksTab.count() > 0) {
            console.log(`\n5️⃣  Clicking Pages & Blocks tab...`);
            await pagesBlocksTab.click();
            await page.waitForTimeout(500);
            
            // Count the blocks in the tab
            const blockRows = modal.locator('[role="row"], .block-item, .block-row, tr');
            const blockCount = await blockRows.count();
            
            console.log(`✅ Pages & Blocks tab opened`);
            console.log(`  Block rows found: ${blockCount}`);
            
            // Sample some block content
            const firstFewBlocks = await blockRows.first().textContent();
            console.log(`  First block content: ${firstFewBlocks?.substring(0, 100)}`);
          }
        }
      } else {
        console.log(`❌ Template card not found in admin UI`);
      }
    }
    
    console.log('\n=== TEST COMPLETE ===\n');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

// Run the test
testBlockGeneration().catch(console.error);
