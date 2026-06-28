import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase';
import { ReadTemplatePackageResult } from './readTemplatePackage';

/**
 * Result of successfully importing a template package into Supabase.
 */
export interface ImportTemplatePackageResult {
  templateId: string;
  templateSlug: string;
  templateName: string;
  status: 'draft' | 'live';
  importedPages: number;
  importedBlocks: number;
  importedBlockTypes: number;
  importId: string;
}

/**
 * Options for importing a template package.
 */
export interface ImportTemplatePackageOptions {
  sourceFilename?: string;
  importedBy?: string | null;
  publish?: boolean;
}

/**
 * Helper: Extract boolean from string environment variable
 */
function isTruthy(value: unknown): value is true {
  return value === true || value === 'true' || value === '1';
}

/**
 * Import a validated template package into Supabase.
 *
 * Process:
 * 1. Create template_imports row with status='processing'
 * 2. Upsert website_templates by slug
 * 3. Get template ID from upserted record
 * 4. Delete existing child rows (pages, blocks, registry)
 * 5. Insert website_template_pages in order
 * 6. For each page, insert website_template_blocks
 * 7. Insert website_template_block_registry entries
 * 8. Update template_imports status='completed'
 *
 * On error:
 * - Update template_imports to status='failed' with validation_errors
 * - Rethrow error with clear message
 *
 * @param packageData - Validated template package from readTemplatePackage()
 * @param options - Import options (sourceFilename, importedBy, publish)
 * @returns ImportTemplatePackageResult with stats
 * @throws Error if any database operation fails
 */
export async function importTemplatePackage(
  packageData: ReadTemplatePackageResult,
  options: ImportTemplatePackageOptions = {}
): Promise<ImportTemplatePackageResult> {
  const { sourceFilename, importedBy = null, publish = false } = options;

  const importId = randomUUID();
  const templateSlug = packageData.templateSlug;
  const templateName = packageData.template.name;
  const status = publish ? 'live' : 'draft';
  let templateId: string | null = null;

  try {
    // Step 1: Create template_imports tracking record
    const { error: createImportError } = await (supabaseAdmin
      .from('template_imports') as any)
      .insert({
        id: importId,
        template_slug: templateSlug,
        template_name: templateName,
        status: 'processing',
        source_filename: sourceFilename || null,
        imported_by: importedBy,
        validation_errors: [],
      });

    if (createImportError) {
      throw new Error(
        `Failed to create import tracking record: ${createImportError.message}`
      );
    }

    // Step 2: Upsert website_templates by slug
    const templateRecord = {
      slug: templateSlug,
      name: templateName,
      version: packageData.template.version || '1.0.0',
      status, // 'draft' or 'live'
      category: packageData.template.category || 'general',
      description: packageData.template.category || null,
      is_active: publish,
      sort_order: 0,
      style: packageData.template.style || null,
      industries: packageData.template.industries || [],
      theme: packageData.theme as any,
      cms_mapping: packageData.cmsMapping as any,
      default_pages: packageData.pagesManifest.pages.map((p) => ({
        slug: p.slug,
        title: p.title,
      })),
      source: {
        import_type: 'zip_package',
        import_id: importId,
        imported_at: new Date().toISOString(),
        ...(sourceFilename && { source_filename: sourceFilename }),
      },
    };

    const { data: upsertedTemplate, error: upsertError } = await (supabaseAdmin
      .from('website_templates') as any)
      .upsert(templateRecord, { onConflict: 'slug' })
      .select('id');

    if (upsertError) {
      throw new Error(`Failed to upsert template: ${upsertError.message}`);
    }

    if (!upsertedTemplate || upsertedTemplate.length === 0) {
      throw new Error('Template upsert returned no rows');
    }

    templateId = upsertedTemplate[0].id;

    // Step 3: Delete existing child rows before inserting fresh data
    // Delete in correct order (blocks before pages before registry)

    const { error: deleteBlocksError } = await (supabaseAdmin
      .from('website_template_blocks') as any)
      .delete()
      .eq('template_id', templateId);

    if (deleteBlocksError) {
      throw new Error(
        `Failed to delete existing blocks: ${deleteBlocksError.message}`
      );
    }

    const { error: deletePagesError } = await (supabaseAdmin
      .from('website_template_pages') as any)
      .delete()
      .eq('template_id', templateId);

    if (deletePagesError) {
      throw new Error(
        `Failed to delete existing pages: ${deletePagesError.message}`
      );
    }

    const { error: deleteRegistryError } = await (supabaseAdmin
      .from('website_template_block_registry') as any)
      .delete()
      .eq('template_id', templateId);

    if (deleteRegistryError) {
      throw new Error(
        `Failed to delete existing block registry: ${deleteRegistryError.message}`
      );
    }

    // Step 4: Insert website_template_pages in order from manifest
    const pageInserts = packageData.pagesManifest.pages.map((page, index) => ({
      template_id: templateId,
      slug: page.slug,
      title: page.title,
      path: page.path,
      block_count: packageData.pages.get(page.slug)?.blocks.length || 0,
      page_order: index + 1,
      seo: null,
    }));

    const { data: insertedPages, error: pagesError } = await (supabaseAdmin
      .from('website_template_pages') as any)
      .insert(pageInserts)
      .select('id, slug');

    if (pagesError) {
      throw new Error(`Failed to insert pages: ${pagesError.message}`);
    }

    if (!insertedPages || insertedPages.length === 0) {
      throw new Error('Page insertion returned no rows');
    }

    // Map page slugs to their IDs for block insertion
    const pageIdMap = new Map<string, string>();
    for (const page of insertedPages) {
      pageIdMap.set(page.slug, page.id);
    }

    // Step 5: Insert website_template_blocks for each page
    let totalBlocksInserted = 0;

    for (const pageEntry of packageData.pagesManifest.pages) {
      const pageId = pageIdMap.get(pageEntry.slug);
      if (!pageId) {
        throw new Error(`Page ID not found for slug: ${pageEntry.slug}`);
      }

      const pageFile = packageData.pages.get(pageEntry.slug);
      if (!pageFile) {
        throw new Error(`Page file not found for slug: ${pageEntry.slug}`);
      }

      const blockInserts = pageFile.blocks.map((block, index) => ({
        page_id: pageId,
        block_id: block.id,
        block_type: block.type,
        block_order: index + 1,
        props: block.props || {},
      }));

      if (blockInserts.length > 0) {
        const { error: blocksError } = await (supabaseAdmin
          .from('website_template_blocks') as any)
          .insert(blockInserts);

        if (blocksError) {
          throw new Error(
            `Failed to insert blocks for page ${pageEntry.slug}: ${blocksError.message}`
          );
        }

        totalBlocksInserted += blockInserts.length;
      }
    }

    // Step 6: Insert website_template_block_registry
    const registryInserts = packageData.blockRegistry.blocks.map((block) => ({
      template_id: templateId,
      block_type: block.type,
      label: block.label,
      category: block.category,
      editable_fields: block.editableFields || [],
    }));

    if (registryInserts.length > 0) {
      const { error: registryError } = await (supabaseAdmin
        .from('website_template_block_registry') as any)
        .insert(registryInserts);

      if (registryError) {
        throw new Error(
          `Failed to insert block registry: ${registryError.message}`
        );
      }
    }

    // Step 7: Update template_imports to completed
    const { error: completeError } = await (supabaseAdmin
      .from('template_imports') as any)
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', importId);

    if (completeError) {
      throw new Error(
        `Failed to mark import as completed: ${completeError.message}`
      );
    }

    // Step 8: Return success result
    return {
      templateId: templateId!,
      templateSlug,
      templateName,
      status,
      importedPages: packageData.stats.pageCount,
      importedBlocks: packageData.stats.blockCount,
      importedBlockTypes: packageData.stats.blockTypes.length,
      importId,
    };

  } catch (error) {
    // On error: update template_imports with failure status and error message
    if (templateId) {
      try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await (supabaseAdmin
          .from('template_imports') as any)
          .update({
            status: 'failed',
            validation_errors: [{ error: errorMessage, timestamp: new Date().toISOString() }],
          })
          .eq('id', importId);
      } catch (updateError) {
        console.error(
          `Failed to update import status to failed: ${updateError instanceof Error ? updateError.message : updateError}`
        );
      }
    }

    // Rethrow original error
    throw error;
  }
}
