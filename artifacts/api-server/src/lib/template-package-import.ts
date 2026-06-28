/**
 * Import service for TWD template packages
 * 
 * Handles database operations for importing template packages:
 * - Creates/updates template records
 * - Inserts pages and blocks
 * - Manages import status tracking
 * - Handles cleanup and error recovery
 */

import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "./supabase";

export type ImportedTemplateContent = {
  manifest: {
    slug: string;
    name: string;
    description?: string | null;
    category?: string | null;
    version?: number | string | null;
  };
  pages: Array<{
    slug: string;
    title: string;
    path: string;
    page_type: string;
    sort_order: number;
    seo: Record<string, unknown>;
    settings: Record<string, unknown>;
    blocks: Array<{
      type: string;
      block_type: string;
      label?: string;
      content?: Record<string, unknown>;
      settings?: Record<string, unknown>;
      sort_order: number;
    }>;
  }>;
  themeJson: Record<string, unknown>;
  cmsMappingJson: Record<string, unknown>;
};

export interface ImportTemplatePackageOptions {
  sourceFilename?: string;
  importedBy?: string | null;
  publish?: boolean;
}

export interface ImportTemplatePackageResult {
  templateId: string;
  templateSlug: string;
  templateName: string;
  status: "draft" | "published";
  importedPages: number;
  importedBlocks: number;
  importId: string;
}

/**
 * Import a template package into the database
 * 
 * Process:
 * 1. Create import tracking record with status 'processing'
 * 2. Upsert template record
 * 3. Clean up existing pages/blocks
 * 4. Insert pages in order
 * 5. Insert blocks for each page
 * 6. Insert block registry entries
 * 7. Update import status to 'completed'
 * 
 * If any step fails, import status is set to 'failed' and error is rethrown
 */
export async function importTemplatePackage(
  packageData: ImportedTemplateContent,
  options: ImportTemplatePackageOptions = {},
): Promise<ImportTemplatePackageResult> {
  const {
    sourceFilename,
    importedBy = null,
    publish = false,
  } = options;

  const importId = uuidv4();
  const templateId = uuidv4();
  const templateSlug = packageData.manifest.slug;
  const templateName = packageData.manifest.name;
  const status = publish ? "published" : "draft";

  try {
    // Step 1: Create import tracking record
    const { error: importRecordError } = await supabaseAdmin
      .from("template_imports")
      .insert({
        id: importId,
        template_slug: templateSlug,
        status: "processing",
        imported_by: importedBy,
        source_filename: sourceFilename,
        started_at: new Date().toISOString(),
      });

    if (importRecordError) {
      throw new Error(`Failed to create import record: ${importRecordError.message}`);
    }

    // Step 2: Check if template exists and get its ID
    const { data: existingTemplate, error: existingError } = await supabaseAdmin
      .from("website_templates")
      .select("id, version")
      .eq("slug", templateSlug)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing template: ${existingError.message}`);
    }

    const finalTemplateId = existingTemplate?.id || templateId;
    const nextVersion = existingTemplate?.version
      ? Number(existingTemplate.version) + 1
      : typeof packageData.manifest.version === "number"
        ? packageData.manifest.version
        : 1;

    // Step 3: Delete existing pages/blocks if template exists
    if (existingTemplate?.id) {
      const { error: deleteBlocksError } = await supabaseAdmin
        .from("website_template_blocks")
        .delete()
        .eq("template_id", existingTemplate.id);

      if (deleteBlocksError) {
        throw new Error(`Failed to delete existing blocks: ${deleteBlocksError.message}`);
      }

      const { error: deletePagesError } = await supabaseAdmin
        .from("website_template_pages")
        .delete()
        .eq("template_id", existingTemplate.id);

      if (deletePagesError) {
        throw new Error(`Failed to delete existing pages: ${deletePagesError.message}`);
      }

      // Also delete block registry if it exists
      const { error: deleteRegistryError } = await supabaseAdmin
        .from("website_template_block_registry")
        .delete()
        .eq("template_id", existingTemplate.id);

      if (deleteRegistryError && !deleteRegistryError.message.includes("does not exist")) {
        throw new Error(`Failed to delete existing registry: ${deleteRegistryError.message}`);
      }
    }

    // Step 4: Upsert template record
    const templateRecord = {
      id: finalTemplateId,
      name: templateName,
      slug: templateSlug,
      description: packageData.manifest.description || null,
      category: packageData.manifest.category || "general",
      version: nextVersion,
      status: status === "published" ? "published" : "draft",
      is_active: publish,
      is_featured: false,
      sort_order: 0,
      created_by: importedBy || null,
      source_upload_id: null,
      template_json: packageData.manifest,
      theme: packageData.themeJson,
      cms_mapping: packageData.cmsMappingJson,
      theme_json: packageData.themeJson,
      cms_mapping_json: packageData.cmsMappingJson,
      default_theme: packageData.themeJson,
      default_pages: packageData.pages,
      design_tokens: {},
      source: {
        import_type: "package",
        import_id: importId,
        source_filename: sourceFilename,
        imported_at: new Date().toISOString(),
        imported_by: importedBy,
      },
    };

    const { error: upsertError } = await supabaseAdmin
      .from("website_templates")
      .upsert(templateRecord, { onConflict: "slug" });

    if (upsertError) {
      throw new Error(`Failed to upsert template: ${upsertError.message}`);
    }

    // Step 5: Insert pages
    const pageInserts = packageData.pages.map((page) => ({
      id: uuidv4(),
      template_id: finalTemplateId,
      slug: page.slug,
      title: page.title,
      path: page.path,
      page_type: page.page_type,
      sort_order: page.sort_order,
      seo: page.seo,
      settings: page.settings,
    }));

    const { data: insertedPages, error: pagesError } = await supabaseAdmin
      .from("website_template_pages")
      .insert(pageInserts)
      .select("id, slug");

    if (pagesError || !insertedPages) {
      throw new Error(`Failed to insert pages: ${pagesError?.message || "No pages inserted"}`);
    }

    // Create map of page slugs to IDs
    const pageIdBySlug = new Map<string, string>();
    for (const page of insertedPages) {
      pageIdBySlug.set(page.slug, page.id);
    }

    // Step 6: Insert blocks
    let totalBlocksImported = 0;
    const blockInserts = packageData.pages.flatMap((page) => {
      const pageId = pageIdBySlug.get(page.slug);
      if (!pageId) return [];

      totalBlocksImported += page.blocks.length;
      return page.blocks.map((block) => ({
        id: uuidv4(),
        template_id: finalTemplateId,
        page_id: pageId,
        block_type: block.block_type || block.type,
        label: block.label || null,
        sort_order: block.sort_order,
        content: block.content || {},
        settings: block.settings || {},
      }));
    });

    if (blockInserts.length > 0) {
      const { error: blocksError } = await supabaseAdmin
        .from("website_template_blocks")
        .insert(blockInserts);

      if (blocksError) {
        throw new Error(`Failed to insert blocks: ${blocksError.message}`);
      }
    }

    // Step 7: Insert block registry entries (if table exists)
    const registryInserts = packageData.pages.flatMap((page) => {
      return page.blocks.map((block) => ({
        id: uuidv4(),
        template_id: finalTemplateId,
        block_type: block.block_type || block.type,
        label: block.label || block.block_type || block.type,
        category: "imported",
        sort_order: 0,
      }));
    });

    // Remove duplicates by block_type
    const uniqueRegistry = Array.from(
      new Map(registryInserts.map((item) => [item.block_type, item])).values()
    );

    if (uniqueRegistry.length > 0) {
      const { error: registryError } = await supabaseAdmin
        .from("website_template_block_registry")
        .insert(uniqueRegistry);

      // Don't fail if registry table doesn't exist
      if (registryError && !registryError.message.includes("does not exist")) {
        console.warn("[importTemplatePackage] Registry insert failed (non-critical):", registryError);
      }
    }

    // Step 8: Mark import as completed
    const { error: completeError } = await supabaseAdmin
      .from("template_imports")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);

    if (completeError) {
      console.warn("[importTemplatePackage] Failed to mark import completed:", completeError);
    }

    return {
      templateId: finalTemplateId,
      templateSlug,
      templateName,
      status: status as "draft" | "published",
      importedPages: packageData.pages.length,
      importedBlocks: totalBlocksImported,
      importId,
    };
  } catch (error) {
    // Mark import as failed with error details
    const errorMessage = error instanceof Error ? error.message : String(error);
    const validationErrors = [errorMessage];

    try {
      await supabaseAdmin
        .from("template_imports")
        .update({
          status: "failed",
          validation_errors: validationErrors,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importId);
    } catch (updateError) {
      console.error("[importTemplatePackage] Failed to mark import as failed:", updateError);
    }

    // Rethrow the original error
    throw error;
  }
}
