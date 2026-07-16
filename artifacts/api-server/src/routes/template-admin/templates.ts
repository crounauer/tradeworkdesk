/**
 * Template Management API
 * POST /api/template-admin/templates/upload-zip - Upload Figma template ZIP
 * GET /api/template-admin/templates - List all templates
 * GET /api/template-admin/templates/:id - Get template details
 * PATCH /api/template-admin/templates/:id - Update template
 * DELETE /api/template-admin/templates/:id - Delete template
 */

import { createHash } from "crypto";
import { Router, Request, Response } from "express";
import multer from "multer";
import { supabaseAdmin as supabase } from "../../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../../middlewares/auth";
import {
  parseFigmaTemplateZip,
  validateDesignTokens,
  tokensToCSS,
} from "../../lib/figma-template-parser";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 200,
    fileSize: 100 * 1024 * 1024,
  },
});
const TEMPLATE_PACKAGE_BUCKET = "template-packages";
const TEMPLATE_ASSET_BUCKET = "template-assets";

function sanitizeBaseName(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "image";
}

function inferImageExtension(file: Express.Multer.File): string {
  const fromName = (file.originalname.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return map[file.mimetype] || "bin";
}

type TemplateFileNode = {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  children?: TemplateFileNode[];
};

function toFileTree(paths: Array<{ path: string; size?: number }>): TemplateFileNode[] {
  const root: TemplateFileNode[] = [];

  const findOrCreateDir = (children: TemplateFileNode[], name: string, path: string): TemplateFileNode => {
    const existing = children.find((n) => n.type === "directory" && n.name === name && n.path === path);
    if (existing) return existing;
    const created: TemplateFileNode = { name, type: "directory", path, children: [] };
    children.push(created);
    return created;
  };

  for (const item of paths) {
    const normalized = item.path.replace(/^\/+/, "").replace(/\/+/g, "/");
    if (!normalized) continue;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let cursor = root;
    let prefix = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      prefix = prefix ? `${prefix}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      if (isLeaf) {
        cursor.push({
          name: part,
          type: "file",
          path: prefix,
          size: item.size,
        });
      } else {
        const dir = findOrCreateDir(cursor, part, prefix);
        cursor = dir.children!;
      }
    }
  }

  const sortNodes = (nodes: TemplateFileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(root);
  return root;
}

async function uploadTemplateImage(templateId: string, image: Express.Multer.File, index: number) {
  const ext = inferImageExtension(image);
  const baseName = sanitizeBaseName(image.originalname);
  const storagePath = `template-assets/${templateId}/1/${Date.now()}-${index}-${baseName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(TEMPLATE_ASSET_BUCKET)
    .upload(storagePath, image.buffer, {
      contentType: image.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image '${image.originalname}': ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(TEMPLATE_ASSET_BUCKET).getPublicUrl(storagePath);
  return {
    file_name: image.originalname,
    storage_path: storagePath,
    public_url: publicUrlData.publicUrl,
    mime_type: image.mimetype,
    size: image.size,
  };
}

/**
 * POST /api/template-admin/templates/upload-zip
 * Upload a Figma-exported ZIP file as a template
 */
router.post(
  "/upload-zip",
  requireAuth,
  requireRole("super_admin"),
  (req, res, next) => {
    upload.any()(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const multerErr = err as multer.MulterError & { field?: string };
        console.error("[upload-zip] Multer error:", {
          code: multerErr.code,
          message: multerErr.message,
          field: multerErr.field,
        });
        return res.status(400).json({
          error: multerErr.message,
          code: multerErr.code,
          field: multerErr.field,
        });
      }
      console.error("[upload-zip] Unknown multipart error:", err);
      return res.status(400).json({ error: "Failed to parse multipart upload" });
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    let uploadId: string | null = null;
    try {
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const zipFile = files.find((file) => file.fieldname === "file" || file.originalname.toLowerCase().endsWith(".zip"));
      const imageFiles = files.filter((file) => file !== zipFile && file.mimetype.startsWith("image/"));

      console.log("[upload-zip] Starting upload, zip size:", zipFile?.size, "images:", imageFiles.length);

      if (!zipFile) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      if (!zipFile.originalname.toLowerCase().endsWith(".zip")) {
        res.status(400).json({ error: "The 'file' field must be a .zip file" });
        return;
      }

      uploadId = uuidv4();
      const packagePath = `template-packages/${uploadId}/original.zip`;
      const checksumSha256 = createHash("sha256").update(zipFile.buffer).digest("hex");

      const { error: packageUploadError } = await supabase.storage
        .from(TEMPLATE_PACKAGE_BUCKET)
        .upload(packagePath, zipFile.buffer, {
          contentType: zipFile.mimetype || "application/zip",
          upsert: false,
        });

      if (packageUploadError) {
        res.status(500).json({ error: `Failed to store uploaded ZIP: ${packageUploadError.message}` });
        return;
      }

      const uploadRecord = await supabase
        .from("website_template_uploads")
        .insert({
          id: uploadId,
          file_name: zipFile.originalname,
          original_zip_metadata: {
            original_filename: zipFile.originalname,
            zip_file_count: files.length,
            image_file_count: imageFiles.length,
          },
          storage_bucket: TEMPLATE_PACKAGE_BUCKET,
          storage_path: packagePath,
          checksum_sha256: checksumSha256,
          file_size_bytes: zipFile.size,
          mime_type: zipFile.mimetype || "application/zip",
          validation_status: "uploaded",
          created_by: req.userId,
        })
        .select("id")
        .single();

      if (uploadRecord.error) {
        res.status(500).json({ error: `Failed to create upload record: ${uploadRecord.error.message}` });
        return;
      }

      const invalidImage = imageFiles.find((file) => !file.mimetype.startsWith("image/"));
      if (invalidImage) {
        res.status(400).json({ error: `Invalid image file: ${invalidImage.originalname}` });
        return;
      }

      console.log("[upload-zip] Parsing ZIP file...");
      // JSZip supports Node.js Buffer directly
      const parsed = await parseFigmaTemplateZip(zipFile.buffer);
      console.log("[upload-zip] ZIP parsed successfully, metadata:", parsed.metadata);

      // Figma exports usually have no metadata.json, so prefer the values the
      // admin supplied in the upload form, falling back to anything parsed.
      const slugify = (value: string) =>
        value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

      const formName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const formDisplayName =
        typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
      const formDescription =
        typeof req.body?.description === "string" ? req.body.description.trim() : "";
      const fallbackFromFile = (zipFile.originalname || "")
        .replace(/\.zip$/i, "")
        .trim();

      const displayName =
        formDisplayName ||
        (parsed.metadata.name !== "Untitled Template" ? parsed.metadata.name : "") ||
        fallbackFromFile ||
        "Untitled Template";
      const slug =
        slugify(formName) ||
        (parsed.metadata.slug !== "untitled-template" ? parsed.metadata.slug : "") ||
        slugify(fallbackFromFile) ||
        "untitled-template";

      parsed.metadata = {
        ...parsed.metadata,
        name: displayName,
        slug,
        description: formDescription || parsed.metadata.description,
      };

      console.log("[upload-zip] Validating design tokens...");
      // Validate design tokens
      const validation = validateDesignTokens(parsed.designTokens);
      if (!validation.valid) {
        console.log("[upload-zip] Validation failed:", validation.warnings);
        await supabase
          .from("website_template_uploads")
          .update({
            validation_status: "failed",
            validation_errors: validation.warnings,
            failed_at: new Date().toISOString(),
          })
          .eq("id", uploadId);
        res.status(400).json({
          error: "Invalid template: design tokens incomplete",
          warnings: validation.warnings,
        });
        return;
      }

      console.log("[upload-zip] Checking for existing template...");
      // Check if template slug already exists
      const { data: existing } = await supabase
        .from("website_templates")
        .select("id")
        .eq("slug", parsed.metadata.slug)
        .single();

      if (existing) {
        console.log("[upload-zip] Template already exists with slug:", parsed.metadata.slug);
        await supabase
          .from("website_template_uploads")
          .update({
            validation_status: "failed",
            validation_errors: [`Template with slug '${parsed.metadata.slug}' already exists`],
            failed_at: new Date().toISOString(),
          })
          .eq("id", uploadId);
        res.status(409).json({
          error: `Template with slug '${parsed.metadata.slug}' already exists`,
        });
        return;
      }

      console.log("[upload-zip] Creating template record...");
      // Preview HTML storage skipped for now - can be added via admin UI
      const previewHtmlUrl = null;
      const templateId = uuidv4();
      const templateVersion = 1;

      const uploadedImages = [] as Array<{
        file_name: string;
        storage_path: string;
        public_url: string;
        mime_type: string;
        size: number;
      }>;

      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const imageMeta = await uploadTemplateImage(parsed.metadata.slug, imageFiles[i], i + 1);
          uploadedImages.push(imageMeta);
        }
      }

      const thumbnailUrl = uploadedImages[0]?.public_url || null;

      // Create template record
      const { data: template, error: createError } = await supabase
        .from("website_templates")
        .insert({
          id: templateId,
          name: parsed.metadata.name,
          slug: parsed.metadata.slug,
          description: parsed.metadata.description,
          category: parsed.metadata.category || "general",
          version: templateVersion,
          design_tokens: parsed.designTokens,
          preview_html_url: previewHtmlUrl,
          thumbnail_url: thumbnailUrl,
          source_upload_id: uploadId,
          status: "validated",
          figma_export_info: {
            exported_at: new Date().toISOString(),
            figma_project_url: parsed.metadata.figmaProjectUrl,
            extracted_files: parsed.archiveFiles,
            uploaded_images_count: uploadedImages.length,
            uploaded_images: uploadedImages,
            preview_html: parsed.previewHtml || null,
            extracted_css: parsed.extractedCss || null,
          },
          created_by: req.userId,
          is_active: false, // Require manual activation
        })
        .select()
        .single();

      if (createError) {
        console.log("[upload-zip] Create error:", createError);
        res.status(500).json({
          error: "Failed to create template",
          details: createError.message,
        });
        return;
      }

      console.log("[upload-zip] Creating version record...");
      // Create initial version record
      await supabase.from("template_versions").insert({
        id: uuidv4(),
        template_id: templateId,
        version: templateVersion,
        design_tokens: parsed.designTokens,
        demo_pages: (parsed.metadata as { demoPages?: unknown[] }).demoPages || [],
        release_notes: "Initial version from Figma export",
      });

      await supabase
        .from("website_template_uploads")
        .update({
          template_id: templateId,
          validation_status: "validated",
          validation_errors: [],
          validated_at: new Date().toISOString(),
        })
        .eq("id", uploadId);

      console.log("[upload-zip] Upload complete!");
      res.json({
        success: true,
        template,
        validation,
        previewUrl: previewHtmlUrl,
        uploadedImages,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? (error.stack || "") : "";
      if (uploadId) {
        await supabase
          .from("website_template_uploads")
          .update({
            validation_status: "failed",
            validation_errors: [errorMsg],
            failed_at: new Date().toISOString(),
          })
          .eq("id", uploadId);
      }
      console.error("[upload-zip] CAUGHT ERROR:", errorMsg);
      console.error("[upload-zip] STACK:", errorStack);
      res.status(500).json({
        error: "Failed to process template ZIP",
        message: errorMsg,
        stack: errorStack.split('\n').slice(0, 5).join('\n'),
      });
    }
  }
);

/**
 * GET /api/admin/templates
 * List all templates
 */
router.get(
  "/:id/files",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { data: templateRow } = await supabase
        .from("website_templates")
        .select("id, slug, version")
        .eq("id", id)
        .maybeSingle();
      const templateSlug = typeof (templateRow as { slug?: string } | null)?.slug === "string"
        ? String((templateRow as { slug: string }).slug)
        : id;
      const templateVersion = typeof (templateRow as { version?: number } | null)?.version === "number"
        ? String((templateRow as { version: number }).version)
        : "1";

      let { data: template, error } = await supabase
        .from("website_templates")
        .select("id, name, figma_export_info")
        .eq("id", id)
        .maybeSingle();

      if ((!template || error) && id) {
        const fallback = await supabase
          .from("website_templates")
          .select("id, name, figma_export_info")
          .eq("slug", id)
          .maybeSingle();
        template = fallback.data;
        error = fallback.error;
      }

      if (error || !template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      const figmaExportInfo = (template as any).figma_export_info || {};
      const extractedFiles = Array.isArray(figmaExportInfo.extracted_files)
        ? figmaExportInfo.extracted_files.filter((v: unknown) => typeof v === "string")
        : [];
      const uploadedImages = Array.isArray(figmaExportInfo.uploaded_images)
        ? figmaExportInfo.uploaded_images
            .filter((v: any) => v && typeof v.file_name === "string")
            .map((v: any) => ({
              file_name: v.file_name,
              public_url: typeof v.public_url === "string" ? v.public_url : null,
              storage_path: typeof v.storage_path === "string" ? v.storage_path : null,
              mime_type: typeof v.mime_type === "string" ? v.mime_type : null,
              path: typeof v.storage_path === "string"
                ? v.storage_path
                : `template-assets/${templateSlug}/${templateVersion}/${v.file_name}`,
              size: typeof v.size === "number" ? v.size : undefined,
            }))
        : [];

      const archivePaths = extractedFiles.map((path: string) => ({ path }));
      const extractedFileTree = toFileTree(archivePaths);
      const files = toFileTree([...archivePaths, ...uploadedImages]);

      res.json({
        templateId: template.id,
        templateName: template.name,
        extractedFiles,
        extractedFileTree,
        files,
        uploadedImages,
      });
      return;
    } catch (err) {
      res.status(500).json({ error: "Failed to load template files" });
      return;
    }
  }
);

router.post(
  "/:id/files/backfill",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      let { data: template, error } = await supabase
        .from("website_templates")
        .select("id, slug, figma_export_info")
        .eq("id", id)
        .maybeSingle();

      if ((!template || error) && id) {
        const fallback = await supabase
          .from("website_templates")
          .select("id, slug, figma_export_info")
          .eq("slug", id)
          .maybeSingle();
        template = fallback.data;
        error = fallback.error;
      }

      if (error || !template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      const figmaExportInfo = ((template as any).figma_export_info || {}) as Record<string, unknown>;
      const templateSlug = String((template as { slug?: string } | null)?.slug || id);
      const templateVersion = "1";

      const { data: listed, error: listError } = await supabase.storage
        .from(TEMPLATE_ASSET_BUCKET)
        .list(`template-assets/${templateSlug}/${templateVersion}`, {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });

      if (listError) {
        res.status(500).json({ error: `Failed to list template images: ${listError.message}` });
        return;
      }

      const uploadedImages = (listed || [])
        .filter((file) => file.name && !file.name.endsWith("/"))
        .map((file) => {
          const storagePath = `template-assets/${templateSlug}/${templateVersion}/${file.name}`;
          const { data: urlData } = supabase.storage.from(TEMPLATE_ASSET_BUCKET).getPublicUrl(storagePath);
          return {
            file_name: file.name,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            mime_type: null,
            size: typeof file.metadata?.size === "number" ? file.metadata.size : undefined,
          };
        });

      const extractedFiles = Array.isArray(figmaExportInfo.extracted_files)
        ? (figmaExportInfo.extracted_files as unknown[]).filter((v): v is string => typeof v === "string")
        : [];

      const nextInfo = {
        ...figmaExportInfo,
        extracted_files: extractedFiles,
        uploaded_images_count: uploadedImages.length,
        uploaded_images: uploadedImages,
      };

      const { error: updateError } = await supabase
        .from("website_templates")
        .update({ figma_export_info: nextInfo })
        .eq("id", template.id);

      if (updateError) {
        res.status(500).json({ error: `Failed to update template metadata: ${updateError.message}` });
        return;
      }

      res.json({
        success: true,
        templateId: template.id,
        extractedFilesCount: extractedFiles.length,
        uploadedImagesCount: uploadedImages.length,
      });
      return;
    } catch (err) {
      res.status(500).json({ error: "Failed to backfill template files" });
      return;
    }
  }
);

router.get(
  "/",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { data: templates, error } = await supabase
        .from("website_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to list templates" });
    }
  }
);

/**
 * GET /api/admin/templates/:id
 * Get template details with usage stats
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Get template
      const { data: template, error: templateError } = await supabase
        .from("website_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (templateError || !template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      // Get version history
      const { data: versions } = await supabase
        .from("template_versions")
        .select("*")
        .eq("template_id", id)
        .order("version", { ascending: false });

      // Get usage count
      const { data: usageLog } = await supabase
        .from("template_usage_log")
        .select("id")
        .eq("template_id", id)
        .eq("action", "applied");

      res.json({
        ...template,
        versions,
        usageCount: usageLog?.length || 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  }
);

/**
 * PATCH /api/admin/templates/:id
 * Update template metadata (name, description, featured, active status)
 */
router.patch(
  "/:id",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Only allow updating these fields
      const allowedFields = [
        "name",
        "description",
        "category",
        "thumbnail_url",
        "is_featured",
        "is_active",
      ];
      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedFields.includes(key))
      );

      const { data: template, error } = await supabase
        .from("website_templates")
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  }
);

/**
 * DELETE /api/admin/templates/:id
 * Delete template (only if not in use)
 */
router.delete(
  "/:id",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if template is in use
      const { data: usageLog } = await supabase
        .from("template_usage_log")
        .select("id")
        .eq("template_id", id)
        .limit(1);

      if (usageLog && usageLog.length > 0) {
        res.status(400).json({
          error: "Cannot delete template that is currently in use",
        });
        return;
      }

      const { error } = await supabase
        .from("website_templates")
        .delete()
        .eq("id", id);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  }
);

/**
 * POST /api/template-admin/templates/:id/generate-pages
 * Generate pages and blocks from template's Figma design
 */
router.post(
  "/:id/generate-pages",
  requireAuth,
  requireRole("super_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      type TemplateRecord = {
        id: string;
        name: string;
        slug: string;
        source_upload_id: string | null;
        figma_export_info: Record<string, unknown> | null;
        design_tokens: Record<string, unknown> | null;
      };

      let template: TemplateRecord | null = null;
      let error: { message: string } | null = null;

      const firstQuery = await supabase
        .from("website_templates")
        .select("id, name, slug, source_upload_id, figma_export_info, design_tokens")
        .eq("id", id)
        .maybeSingle();

      template = (firstQuery.data as TemplateRecord | null) || null;
      error = firstQuery.error ? { message: firstQuery.error.message } : null;

      if ((!template || error) && id) {
        const fallback = await supabase
          .from("website_templates")
          .select("id, name, slug, source_upload_id, figma_export_info, design_tokens")
          .eq("slug", id)
          .maybeSingle();
        template = (fallback.data as TemplateRecord | null) || null;
        error = fallback.error ? { message: fallback.error.message } : null;
      }

      if (error || !template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      const figmaExportInfo = template.figma_export_info || {};
      let previewHtml = (figmaExportInfo.preview_html as string | null) || null;
      let extractedCss = (figmaExportInfo.extracted_css as string | null) || null;
      const uploadedImages = ((figmaExportInfo.uploaded_images as Array<{ public_url: string; file_name: string }>) || []);

      // If preview_html is not stored, try to find and extract from the ZIP in storage
      if (!previewHtml) {
        console.log(`[generate-pages] Preview HTML not found, attempting to extract from storage for template ${template.slug}`);
        
        // Look for ZIP files in the template's image storage
        try {
          const packageFolder = template.source_upload_id
            ? `template-packages/${template.source_upload_id}`
            : `template-packages/${template.id}`;

          const { data: storageFiles, error: listError } = await supabase.storage
            .from(TEMPLATE_PACKAGE_BUCKET)
            .list(packageFolder, { limit: 100 });

          if (!listError && storageFiles) {
            // Find the ZIP file (it might be in root or images folder)
            const zipFile = storageFiles.find((f) => f.name.toLowerCase().endsWith(".zip"));
            
            if (zipFile) {
              console.log(`[generate-pages] Found ZIP file: ${zipFile.name}, attempting to download and parse`);
              
              // Download the ZIP
              const { data: zipData, error: downloadError } = await supabase.storage
                .from(TEMPLATE_PACKAGE_BUCKET)
                .download(`${packageFolder}/${zipFile.name}`);

              if (!downloadError && zipData) {
                // Parse it
                const parsed = await parseFigmaTemplateZip(zipData);
                previewHtml = parsed.previewHtml || null;
                extractedCss = parsed.extractedCss || null;

                // Update the template record with extracted data
                if (previewHtml || extractedCss) {
                  await supabase
                    .from("website_templates")
                    .update({
                      figma_export_info: {
                        ...figmaExportInfo,
                        preview_html: previewHtml,
                        extracted_css: extractedCss,
                      },
                    })
                    .eq("id", template.id);
                }
              }
            }
          }
        } catch (storageErr) {
          console.error(`[generate-pages] Error extracting from storage:`, storageErr);
        }
      }

      if (!previewHtml) {
        res.status(400).json({
          error: "Template has no preview HTML to generate pages from",
          hint: "Please upload the template ZIP file again, or ensure it contains an index.html file",
        });
        return;
      }

      console.log(`[generate-pages] Generating pages from Figma design for template ${template.slug}`);

      // Import the page generator
      const { generatePagesFromFigma, validateGeneratedPages } = await import("../../lib/figma-page-generator");

      // Generate pages from HTML
      const generatedPages = generatePagesFromFigma(previewHtml, uploadedImages);
      
      // Validate
      const validation = validateGeneratedPages(generatedPages);
      if (!validation.valid) {
        console.error("[generate-pages] Validation failed:", validation.errors);
        res.status(400).json({
          error: "Failed to generate valid pages",
          errors: validation.errors,
        });
        return;
      }

      console.log(`[generate-pages] Generated ${generatedPages.length} pages from template`);

      // Store the generated pages as template default_pages
      const { error: updateError } = await supabase
        .from("website_templates")
        .update({
          default_pages: generatedPages,
        })
        .eq("id", template.id);

      if (updateError) {
        console.error("[generate-pages] Update error:", updateError);
        res.status(500).json({
          error: "Failed to save generated pages",
          details: updateError.message,
        });
        return;
      }

      console.log("[generate-pages] Successfully saved generated pages to template");

      res.json({
        success: true,
        pagesCount: generatedPages.length,
        pages: generatedPages,
      });
    } catch (error) {
      console.error("[generate-pages] Error:", error);
      res.status(500).json({
        error: "Failed to generate pages from template",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
