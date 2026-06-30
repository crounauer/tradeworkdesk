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
import { requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";
import { validateTemplateZip } from "../lib/template-zip-validator";
import { findUnsupportedBlockTypes } from "../lib/template-import-safeguards";

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

export default router;
