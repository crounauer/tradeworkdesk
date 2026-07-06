/**
 * Superadmin Template Import Routes
 * 
 * Endpoints for importing TWD template ZIP packages directly
 * Requires superadmin authentication
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";
import { validateTemplateZip } from "../lib/template-zip-validator";
import { findUnsupportedBlockTypes } from "../lib/template-import-safeguards";
import { generateTemplateInstance } from "../lib/template-phase-2";

const router = Router();

const TEMPLATE_PACKAGE_BUCKET = "template-packages";
const TEMPLATE_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB as specified
const TEMP_DIR = path.join(process.cwd(), ".temp-template-imports");

// Ensure temp directory exists
async function ensureTempDir(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error("[superadmin-templates] Failed to create temp directory:", error);
  }
}

// Setup multer with file size limits
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await ensureTempDir();
        cb(null, TEMP_DIR);
      } catch (error) {
        cb(error as Error);
      }
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      cb(null, `${timestamp}-${randomStr}.zip`);
    },
  }),
  limits: {
    fileSize: TEMPLATE_MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".zip")) {
      return cb(new Error("Only .zip files are allowed"));
    }
    if (file.mimetype && file.mimetype !== "application/zip" && file.mimetype !== "application/x-zip-compressed") {
      return cb(new Error("File must be a valid ZIP archive"));
    }
    cb(null, true);
  },
});

// Type definitions
type TemplateManifest = {
  slug: string;
  name: string;
  description?: string | null;
  category?: string | null;
  version?: number | string | null;
};

type TemplatePageManifest = {
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
};

type ImportedTemplateContent = {
  manifest: TemplateManifest;
  pages: TemplatePageManifest[];
  themeJson: Record<string, unknown>;
  cmsMappingJson: Record<string, unknown>;
};

type ImportResponse = {
  success: true;
  templateSlug: string;
  templateName: string;
  status: string;
  importedPages: number;
  importedBlocks: number;
} | {
  success: false;
  error: string;
  details?: Record<string, unknown>;
};

// Utility functions
class TemplateImportError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, opts: { status: number; code: string }) {
    super(message);
    this.status = opts.status;
    this.code = opts.code;
  }
}

function normalizeJson<T>(value: unknown, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Helper: Read JSON file from ZIP
 */
async function readZipJson<T>(zip: JSZip, filepath: string): Promise<T | null> {
  const file = zip.file(filepath);
  if (!file) return null;
  const content = await file.async("text");
  return JSON.parse(content) as T;
}

/**
 * Helper: Extract ZIP file safely
 * Returns the JSZip instance for reading
 */
async function safeZipExtract(zipBuffer: Buffer): Promise<JSZip> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    return zip;
  } catch (error) {
    throw new TemplateImportError("Unable to read ZIP archive", { status: 400, code: "INVALID_ZIP" });
  }
}

/**
 * Helper: Read and parse template package from ZIP
 */
async function readTemplatePackage(zip: JSZip, manifestSlug: string): Promise<ImportedTemplateContent> {
  const templateFolder = `templates/${manifestSlug}`;

  const manifest = (await readZipJson<TemplateManifest>(zip, `${templateFolder}/template.json`)) || {
    slug: manifestSlug,
    name: manifestSlug,
    description: null,
    category: null,
    version: 1,
  };

  const rawPages = await readZipJson<{ pages?: unknown } | unknown[]>(zip, `${templateFolder}/pages/pages.json`);
  const pageEntries = Array.isArray(rawPages)
    ? rawPages
    : Array.isArray(rawPages?.pages)
      ? rawPages.pages
      : [];

  // Parse pages
  const pages: TemplatePageManifest[] = [];
  for (let index = 0; index < pageEntries.length; index += 1) {
    const pageEntry = pageEntries[index];
    const pageKey = typeof pageEntry === "string" ? pageEntry : String((pageEntry as Record<string, unknown>).slug || (pageEntry as Record<string, unknown>).file || (pageEntry as Record<string, unknown>).filename || (pageEntry as Record<string, unknown>).path || "");
    
    // Try multiple candidate file names
    const candidates = [
      `${templateFolder}/pages/${pageKey}`,
      `${templateFolder}/pages/${pageKey}.json`,
      `${templateFolder}/${pageKey}`,
      `${templateFolder}/${pageKey}.json`,
    ]
      .filter((c, i, arr) => arr.indexOf(c) === i); // dedup

    let pageJson: Record<string, unknown> | null = null;
    for (const candidate of candidates) {
      pageJson = await readZipJson<Record<string, unknown>>(zip, candidate);
      if (pageJson) break;
    }

    const content = pageJson || (typeof pageEntry === "object" && pageEntry ? (pageEntry as Record<string, unknown>) : {});
    const slug = String(content.slug || pageKey || `page-${index + 1}`).replace(/\.json$/i, "");
    const title = String(content.title || slug.replace(/-/g, " ")).trim() || slug;
    const blocks = Array.isArray(content.blocks) ? content.blocks : [];

    pages.push({
      slug,
      title,
      path: `${slug}.json`,
      page_type: String(content.page_type || (slug === "home" ? "home" : "custom")),
      sort_order: typeof content.sort_order === "number" ? content.sort_order : index,
      seo: normalizeJson(content.seo, {}),
      settings: normalizeJson(content.settings, {}),
      blocks: blocks.map((block, blockIndex) => {
        const blockRecord = block as Record<string, unknown>;
        const blockType = String(blockRecord.type || blockRecord.block_type || "text").trim() || "text";
        return {
          type: blockType,
          block_type: blockType,
          label: typeof blockRecord.label === "string" ? blockRecord.label : undefined,
          content: normalizeJson(blockRecord.content, {}),
          settings: normalizeJson(blockRecord.settings, {}),
          sort_order: typeof blockRecord.sort_order === "number" ? blockRecord.sort_order : blockIndex,
        };
      }),
    });
  }

  // Check for unsupported block types
  const unsupportedBlockTypes = findUnsupportedBlockTypes(pages);
  if (unsupportedBlockTypes.length > 0) {
    throw new TemplateImportError(`Unsupported block type(s): ${unsupportedBlockTypes.join(", ")}`, {
      status: 400,
      code: "UNSUPPORTED_BLOCK_TYPE",
    });
  }

  const themeJson = (await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/styles/theme.json`)) || {};
  const cmsMappingJson =
    (await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/styles/cms-mapping.json`)) ||
    (await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/cms-mapping.json`)) ||
    {};

  return { manifest, pages, themeJson, cmsMappingJson };
}

/**
 * POST /api/superadmin/templates/import
 * Import a TWD template ZIP package
 */
router.post(
  "/api/superadmin/templates/import",
  requireSuperAdmin as any,
  upload.single("templateZip"),
  async (req: AuthenticatedRequest, res: Response<ImportResponse>) => {
    let tempFilePath: string | null = null;

    try {
      // Validate file upload
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
          details: { field: "templateZip" },
        });
      }

      tempFilePath = req.file.path;
      const fileSize = req.file.size;
      const originalName = req.file.originalname;

      // Read ZIP from temp file
      const zipBuffer = await fs.readFile(tempFilePath);

      // Extract and validate ZIP
      const zip = await safeZipExtract(zipBuffer);

      // Validate structure
      const validation = await validateTemplateZip(zipBuffer);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: "Template validation failed",
          details: { errors: validation.errors },
        });
      }

      // Parse template package
      const templateSlug = validation.templateSlug || slugify(validation.templateName || "template");
      const importedContent = await readTemplatePackage(zip, templateSlug);

      // Generate checksum
      const checksum = createHash("sha256").update(zipBuffer).digest("hex");

      // Store ZIP to Supabase storage
      const uploadId = uuidv4();
      const storageFileName = `${uploadId}/${originalName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(TEMPLATE_PACKAGE_BUCKET)
        .upload(storageFileName, zipBuffer, {
          contentType: "application/zip",
          metadata: {
            uploadedBy: req.userId,
            uploadedAt: new Date().toISOString(),
          },
        });

      if (uploadError) {
        console.error("[superadmin-templates] Storage upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          error: "Failed to store template package",
          details: { code: "STORAGE_UPLOAD_FAILED" },
        });
      }

      // Create upload record
      const { data: uploadRecord, error: uploadRecordError } = await supabaseAdmin
        .from("website_template_uploads")
        .insert({
          id: uploadId,
          file_name: originalName,
          file_size_bytes: fileSize,
          checksum_sha256: checksum,
          mime_type: req.file.mimetype,
          storage_bucket: TEMPLATE_PACKAGE_BUCKET,
          storage_path: storageFileName,
          validation_status: "passed",
          validation_errors: validation.errors.length > 0 ? validation.errors : null,
          validation_report: validation,
          uploaded_by: req.userId,
          template_slug: templateSlug,
          original_zip_metadata: {
            validation,
          },
        })
        .select("id")
        .single();

      if (uploadRecordError || !uploadRecord) {
        console.error("[superadmin-templates] Upload record creation failed:", uploadRecordError);
        return res.status(500).json({
          success: false,
          error: "Failed to create upload record",
          details: { code: "DB_RECORD_FAILED" },
        });
      }

      // Insert template and pages/blocks into database
      const templateId = uuidv4();
      const templateRecord = {
        id: templateId,
        name: importedContent.manifest.name,
        slug: importedContent.manifest.slug,
        description: importedContent.manifest.description || null,
        category: importedContent.manifest.category || "general",
        version: 1,
        status: "draft",
        is_active: false,
        is_featured: false,
        sort_order: 0,
        created_by: req.userId,
        source_upload_id: uploadId,
        template_json: importedContent.manifest,
        theme_json: importedContent.themeJson,
        cms_mapping_json: importedContent.cmsMappingJson,
        default_theme: importedContent.themeJson,
        default_pages: importedContent.pages,
        design_tokens: {},
        figma_export_info: {
          import_type: "superadmin_zip",
          validation_report: validation,
          original_zip_metadata: { validation },
          storage_bucket: TEMPLATE_PACKAGE_BUCKET,
          storage_path: storageFileName,
          file_name: originalName,
          file_size_bytes: fileSize,
          checksum_sha256: checksum,
          mime_type: req.file.mimetype,
        },
      };

      const { error: templateError } = await supabaseAdmin
        .from("website_templates")
        .upsert(templateRecord, { onConflict: "slug" });

      if (templateError) {
        console.error("[superadmin-templates] Template creation failed:", templateError);
        return res.status(500).json({
          success: false,
          error: "Failed to create template record",
          details: { code: "TEMPLATE_CREATE_FAILED" },
        });
      }

      // Insert pages and blocks
      let totalBlocksImported = 0;
      for (const page of importedContent.pages) {
        const pageId = uuidv4();
        const blockCount = page.blocks.length;
        totalBlocksImported += blockCount;

        const { error: pageError } = await supabaseAdmin.from("website_template_pages").insert({
          id: pageId,
          template_id: templateId,
          slug: page.slug,
          title: page.title,
          path: page.path,
          page_type: page.page_type,
          sort_order: page.sort_order,
          seo: page.seo,
          settings: page.settings,
        });

        if (pageError) {
          console.error("[superadmin-templates] Page creation failed:", pageError);
          throw pageError;
        }

        // Insert blocks for this page
        if (page.blocks.length > 0) {
          const blockRecords = page.blocks.map((block) => ({
            id: uuidv4(),
            page_id: pageId,
            template_id: templateId,
            type: block.type,
            block_type: block.block_type,
            label: block.label || null,
            content: block.content || {},
            settings: block.settings || {},
            sort_order: block.sort_order,
          }));

          const { error: blocksError } = await supabaseAdmin
            .from("website_template_blocks")
            .insert(blockRecords);

          if (blocksError) {
            console.error("[superadmin-templates] Block creation failed:", blocksError);
            throw blocksError;
          }
        }
      }

      // Update upload record with template_id
      await supabaseAdmin
        .from("website_template_uploads")
        .update({ template_id: templateId })
        .eq("id", uploadId);

      return res.json({
        success: true,
        templateSlug: importedContent.manifest.slug,
        templateName: importedContent.manifest.name,
        status: "draft",
        importedPages: importedContent.pages.length,
        importedBlocks: totalBlocksImported,
      });
    } catch (error) {
      const err = error as any;
      const status = err.status || 500;
      const errorMessage = err.message || "Unknown error occurred";

      console.error("[superadmin-templates] Import failed:", error);

      return res.status(status).json({
        success: false,
        error: errorMessage,
        details: err.code ? { code: err.code } : undefined,
      });
    } finally {
      // Clean up temp file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (error) {
          console.warn("[superadmin-templates] Failed to clean up temp file:", error);
        }
      }
    }
  },
);

/**
 * POST /api/superadmin/templates/convert
 * Convert Figma ZIP + URL to template package (store as pending)
 */
router.post(
  "/superadmin/templates/convert",
  requireAuth,
  requireSuperAdmin,
  upload.single("figmaZip"),
  async (req: AuthenticatedRequest, res: Response<ImportResponse>) => {
    let tempFilePath: string | undefined;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No ZIP file uploaded",
        });
      }

      const { figmaUrl, templateName, industries = [] } = req.body;

      if (!figmaUrl || !templateName) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: figmaUrl and templateName",
        });
      }

      tempFilePath = req.file.path;
      const zipBuffer = await fs.readFile(tempFilePath);

      // Import converter
      const { convertFigmaZipToTemplate, verifyFigmaUrl } = await import("../lib/figma-converter");

      // Verify Figma URL is accessible
      const urlValid = await verifyFigmaUrl(figmaUrl);
      if (!urlValid) {
        console.warn("[POST /convert] Figma URL may not be accessible:", figmaUrl);
        // Continue anyway - URL might be private/behind auth
      }

      // Convert Figma ZIP to template analysis
      const conversionResult = await convertFigmaZipToTemplate(
        zipBuffer,
        figmaUrl,
        templateName,
        Array.isArray(industries) ? industries : industries ? [industries] : []
      );

      if (!conversionResult.success) {
        return res.status(400).json({
          success: false,
          error: conversionResult.error || "Conversion failed",
        });
      }

      // Store ZIP in Supabase for later reference
      const zipFileName = `conversions/${uuidv4()}/figma-export.zip`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(TEMPLATE_PACKAGE_BUCKET)
        .upload(zipFileName, zipBuffer, {
          contentType: "application/zip",
          metadata: {
            uploadedBy: req.userId,
            convertedAt: new Date().toISOString(),
          },
        });

      if (uploadError) {
        console.error("[POST /convert] Storage upload failed:", uploadError);
        throw new TemplateImportError("Failed to store ZIP file", { status: 500, code: "STORAGE_UPLOAD_FAILED" });
      }

      // Insert conversion record with status='pending'
      const { data: conversion, error: dbError } = await supabaseAdmin
        .from("template_conversions")
        .insert({
          status: "pending",
          figma_url: figmaUrl,
          figma_zip_url: uploadData.path,
          template_name: conversionResult.templateName,
          template_slug: conversionResult.templateSlug,
          template_description: conversionResult.templateDescription,
          industries: Array.isArray(industries) ? industries : industries ? [industries] : [],
          block_mapping_report: {
            pages: conversionResult.pages,
            blocksPerPage: conversionResult.blocksPerPage,
            blockTypes: conversionResult.blockTypes,
          },
          design_tokens: conversionResult.designTokens,
          created_by: req.userId,
        })
        .select()
        .single();

      if (dbError) {
        console.error("[POST /convert] DB Error:", dbError);
        throw new TemplateImportError("Failed to save conversion record", { status: 500, code: "DB_RECORD_FAILED" });
      }

      if (!conversion) {
        console.error("[POST /convert] No conversion returned from DB");
        throw new TemplateImportError("Failed to save conversion record", { status: 500, code: "DB_RECORD_FAILED" });
      }

      console.log(`[POST /convert] Conversion created: ${conversion.id}`, {
        designTokens: conversion.design_tokens,
        blockMapping: conversion.block_mapping_report,
      });

      return res.json({
        success: true,
        templateSlug: conversionResult.templateSlug,
        templateName: conversionResult.templateName,
        status: "pending",
        importedPages: conversionResult.pages.length,
        importedBlocks: Object.values(conversionResult.blocksPerPage).reduce((a, b) => a + b, 0),
      });
    } catch (error) {
      const err = error as any;
      const status = err.status || 500;
      const errorMessage = err.message || "Conversion failed";

      console.error("[POST /convert] Error:", error);

      return res.status(status).json({
        success: false,
        error: errorMessage,
        details: err.code ? { code: err.code } : undefined,
      });
    } finally {
      // Clean up temp file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (error) {
          console.warn("[POST /convert] Failed to clean up temp file:", error);
        }
      }
    }
  }
);

/**
 * GET /api/superadmin/templates/pending
 * List all pending template conversions
 */
router.get(
  "/superadmin/templates/pending",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("template_conversions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        throw new TemplateImportError("Failed to fetch pending templates", { status: 500, code: "DB_QUERY_FAILED" });
      }

      console.log(`[GET /pending] Found ${data?.length || 0} pending templates`);

      return res.json({
        success: true,
        pending: data || [],
        count: data?.length || 0,
      });
    } catch (error) {
      const err = error as any;
      const status = err.status || 500;
      const errorMessage = err.message || "Failed to fetch pending templates";

      console.error("[GET /pending] Error:", error);

      return res.status(status).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

/**
 * PATCH /api/superadmin/templates/:id/approve
 * Approve pending conversion → publish to tenant dashboard
 * 
 * In Phase 2, this will trigger full template package generation
 * For MVP, just marks as approved and copies to website_templates
 */
router.patch(
  "/superadmin/templates/:id/approve",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Get conversion record
      const { data: conversion, error: fetchError } = await supabaseAdmin
        .from("template_conversions")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !conversion) {
        return res.status(404).json({
          success: false,
          error: "Conversion not found",
        });
      }

      if (conversion.status !== "pending") {
        return res.status(400).json({
          success: false,
          error: `Cannot approve template with status='${conversion.status}'`,
        });
      }

      // Update conversion status
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("template_conversions")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: req.userId,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError || !updated) {
        throw new TemplateImportError("Failed to approve template", { status: 500, code: "DB_UPDATE_FAILED" });
      }

      // Phase 2: Generate template instance with pages and blocks
      console.log(`[PATCH /:id/approve] Triggering Phase 2 for template: ${conversion.template_slug}`);
      
      const phase2Result = await generateTemplateInstance(
        supabaseAdmin,
        id,
        conversion.template_slug,
        req.userId
      );

      if (!phase2Result.success) {
        throw new TemplateImportError(`Phase 2 failed: ${phase2Result.error}`, { status: 500, code: "PHASE_2_FAILED" });
      }

      console.log(
        `[PATCH /:id/approve] Phase 2 complete: ${phase2Result.pages.length} pages, ${phase2Result.block_count} blocks`
      );

      return res.json({
        success: true,
        message: "Template approved and published",
        template: {
          ...updated,
          template_id: phase2Result.template_id,
          pages_generated: phase2Result.pages.length,
          blocks_generated: phase2Result.block_count,
        },
      });
    } catch (error) {
      const err = error as any;
      const status = err.status || 500;
      const errorMessage = err.message || "Approval failed";

      console.error("[PATCH /:id/approve] Error:", error);

      return res.status(status).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

/**
 * PATCH /api/superadmin/templates/:id/reject
 * Reject a pending conversion
 */
router.patch(
  "/superadmin/templates/:id/reject",
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Get conversion record
      const { data: conversion, error: fetchError } = await supabaseAdmin
        .from("template_conversions")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !conversion) {
        return res.status(404).json({
          success: false,
          error: "Conversion not found",
        });
      }

      if (conversion.status !== "pending") {
        return res.status(400).json({
          success: false,
          error: `Cannot reject template with status='${conversion.status}'`,
        });
      }

      // Update conversion status
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("template_conversions")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          error_message: reason || "Rejected by superadmin",
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError || !updated) {
        throw new TemplateImportError("Failed to reject template", { status: 500, code: "DB_UPDATE_FAILED" });
      }

      console.log(`[PATCH /:id/reject] Template rejected: ${conversion.template_slug}`);

      return res.json({
        success: true,
        message: "Template rejected",
        template: updated,
      });
    } catch (error) {
      const err = error as any;
      const status = err.status || 500;
      const errorMessage = err.message || "Rejection failed";

      console.error("[PATCH /:id/reject] Error:", error);

      return res.status(status).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

export default router;
