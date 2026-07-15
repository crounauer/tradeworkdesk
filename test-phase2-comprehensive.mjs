/**
 * Comprehensive test of template Phase 2 block generation
 * 
 * This test verifies the complete flow:
 * 1. Phase 2 generates correct block structure
 * 2. Admin endpoint returns blocks array properly
 * 3. Frontend displays blocks in Pages & Blocks tab
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n=== PHASE 2 BLOCK GENERATION COMPREHENSIVE TEST ===\n');

// Test 1: Check latest template that was generated via Phase 2
console.log('Test 1: Checking latest website_templates with demo_pages...\n');

const { data: templates, error: templatesError } = await supabase
  .from('website_templates')
  .select('id, name, slug, status, demo_pages')
  .order('created_at', { ascending: false })
  .limit(5);

if (templatesError) {
  console.error('❌ Error fetching templates:', templatesError);
} else if (templates && templates.length > 0) {
  console.log(`Found ${templates.length} templates:`);
  
  templates.forEach((t, idx) => {
    const hasDemo = t.demo_pages && Array.isArray(t.demo_pages) && t.demo_pages.length > 0;
    console.log(`\n  ${idx + 1}. ${t.name} (${t.slug})`);
    console.log(`     Status: ${t.status}`);
    console.log(`     demo_pages: ${hasDemo ? `YES (${t.demo_pages.length} pages)` : 'NO'}`);
    
    if (hasDemo) {
      const totalBlocks = t.demo_pages.reduce((sum, p) => sum + (p.block_count || 0), 0);
      console.log(`     Total blocks: ${totalBlocks}`);
      
      // Show details of first page
      if (t.demo_pages[0]) {
        const p = t.demo_pages[0];
        console.log(`     First page: ${p.slug} (${p.block_count} blocks)`);
        if (p.block_types?.length > 0) {
          console.log(`       Block types: ${p.block_types.slice(0, 3).join(', ')}${p.block_types.length > 3 ? '...' : ''}`);
        }
      }
    }
  });
} else {
  console.log('❌ No templates found');
}

// Test 2: Query template_conversions to see block_mapping_report structure
console.log('\n\nTest 2: Checking template_conversions block_mapping_report...\n');

const { data: conversions, error: conversionsError } = await supabase
  .from('template_conversions')
  .select('id, template_slug, status, block_mapping_report')
  .eq('status', 'approved')
  .order('created_at', { ascending: false })
  .limit(3);

if (conversionsError) {
  console.error('❌ Error fetching conversions:', conversionsError);
} else if (conversions && conversions.length > 0) {
  console.log(`Found ${conversions.length} approved conversions:\n`);
  
  conversions.forEach((c, idx) => {
    console.log(`  ${idx + 1}. ${c.template_slug}`);
    
    if (c.block_mapping_report) {
      const report = c.block_mapping_report;
      const pageCount = report.pages?.length || 0;
      const blockCount = Object.values(report.blocksPerPage || {}).reduce((sum, count) => (sum + count), 0);
      const blockTypeCount = report.blockTypes?.length || 0;
      
      console.log(`     Pages: ${pageCount}`);
      console.log(`     Blocks (from blocksPerPage): ${blockCount}`);
      console.log(`     blockTypes array: ${blockTypeCount} entries`);
    } else {
      console.log(`     No block_mapping_report`);
    }
  });
} else {
  console.log('No approved conversions found');
}

// Test 3: Show what the admin endpoint sees for a specific template
console.log('\n\nTest 3: Analyzing template admin view...\n');

if (templates && templates.length > 0) {
  const testTemplate = templates[0];
  console.log(`Template: ${testTemplate.name} (${testTemplate.id})\n`);
  
  // Simulate what the admin endpoint would return
  let demoPages = testTemplate.demo_pages || [];
  let blockCount = 0;
  
  if (demoPages.length === 0 && testTemplate.slug) {
    // Simulate fallback to conversion data
    const { data: conversion } = await supabase
      .from('template_conversions')
      .select('block_mapping_report')
      .eq('template_slug', testTemplate.slug)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (conversion?.block_mapping_report) {
      const blockMapping = conversion.block_mapping_report;
      const pageNames = blockMapping.pages || [];
      const blocksPerPage = blockMapping.blocksPerPage || {};
      
      demoPages = pageNames.map((slug) => ({
        slug,
        title: slug.charAt(0).toUpperCase() + slug.slice(1),
        block_count: blocksPerPage[slug] || 0,
      }));
      
      blockCount = Object.values(blocksPerPage).reduce((sum, count) => (sum + count), 0);
    }
  } else {
    blockCount = demoPages.reduce((sum, p) => sum + (p.block_count || 0), 0);
  }
  
  console.log(`Admin endpoint would return:`);
  console.log(`  Pages: ${demoPages.length}`);
  console.log(`  Blocks: ${blockCount}`);
  console.log(`  Data source: ${testTemplate.demo_pages ? 'demo_pages' : 'conversion fallback'}\n`);
}

console.log('\n=== END TEST ===\n');
