import { createHash } from "crypto";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";
import { validateTemplateZip } from "../lib/template-zip-validator";
import { findUnsupportedBlockTypes } from "../lib/template-import-safeguards";

const router = Router();

const TEMPLATE_PACKAGE_BUCKET = "template-packages";
const TEMPLATE_MAX_FILE_SIZE = 100 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TEMPLATE_MAX_FILE_SIZE,
    files: 1,
  },
});

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
  contentModes: {
    defaultMode: string;
    modes: Array<{ mode: string; file?: string; label?: string; description?: string }>;
    seeds: Record<string, unknown>;
  } | null;
};

type TemplateRow = {
  id: string;
  name: string;
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
  source_upload_id?: string | null;
  is_active?: boolean | null;
  status?: string | null;
  published_at?: string | null;
};

type TemplateUploadRow = {
  id?: string;
  created_at?: string | null;
  original_zip_metadata?: {
    validation?: unknown;
  } | null;
  validation_status?: string | null;
  validation_errors?: unknown;
} | null;

function isMissingTemplateUploadsTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /website_template_uploads/i.test(message) && /(schema cache|does not exist|relation .* does not exist|Could not find the table)/i.test(message);
}

function isMissingTemplateImportSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /(website_template_uploads|website_template_pages|website_template_blocks|template_versions|website_templates)/i.test(message)
    && /(schema cache|does not exist|relation .* does not exist|Could not find the table|column .* does not exist)/i.test(message);
}

async function getLatestTemplateUpload(templateId: string, columns = "*"): Promise<{ data: TemplateUploadRow; missingTable: boolean }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("website_template_uploads")
      .select(columns)
      .eq("template_id", templateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTemplateUploadsTableError(error)) {
        return { data: null, missingTable: true };
      }
      throw error;
    }

    return { data: (data as TemplateUploadRow) || null, missingTable: false };
  } catch (error) {
    if (isMissingTemplateUploadsTableError(error)) {
      return { data: null, missingTable: true };
    }
    throw error;
  }
}

function normalizeTemplateStatus(template: TemplateRow): string {
  if (typeof template.status === "string" && template.status.length > 0) return template.status;
  if (template.is_active) return "published";
  return template.published_at ? "validated" : "draft";
}

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

function ensureZipFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) {
    throw new Error("No file uploaded");
  }
  if (!file.originalname.toLowerCase().endsWith(".zip")) {
    throw new Error("The upload must be a .zip file");
  }
  if (file.mimetype && file.mimetype !== "application/zip" && file.mimetype !== "application/x-zip-compressed") {
    throw new Error("The upload must be a ZIP archive");
  }
}

async function readZipJson<T>(zip: JSZip, path: string): Promise<T | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  const text = await entry.async("text");
  return JSON.parse(text) as T;
}

async function insertTemplateAuditLog(opts: {
  actorId?: string;
  actorEmail?: string;
  eventType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: opts.actorId || null,
    actor_email: opts.actorEmail || null,
    event_type: opts.eventType,
    entity_type: "website_template",
    entity_id: opts.entityId || null,
    detail: opts.detail || {},
  });
}

function resolvePageFileCandidates(pageSlug: string): string[] {
  const base = pageSlug.replace(/\.json$/i, "");
  const aliases: Record<string, string> = {
    areas: "areas.json",
    "areas-covered": "areas-covered.json",
    blog: "blog.json",
    "blog-index": "blog-index.json",
    privacy: "privacy.json",
    "privacy-policy": "privacy-policy.json",
    terms: "terms.json",
    "terms-conditions": "terms-conditions.json",
  };

  const candidates = new Set<string>([
    `pages/${base}.json`,
    `pages/${base}`,
    `pages/${aliases[base] || `${base}.json`}`,
  ]);

  return [...candidates];
}

async function parseImportedTemplateContent(zipBuffer: Buffer, manifestSlug: string): Promise<ImportedTemplateContent> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new TemplateImportError("Unable to read ZIP archive", { status: 400, code: "INVALID_ZIP" });
  }
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

  const pages: TemplatePageManifest[] = [];
  for (let index = 0; index < pageEntries.length; index += 1) {
    const pageEntry = pageEntries[index];
    const pageKey = typeof pageEntry === "string" ? pageEntry : String((pageEntry as Record<string, unknown>).slug || (pageEntry as Record<string, unknown>).file || (pageEntry as Record<string, unknown>).filename || (pageEntry as Record<string, unknown>).path || "");
    const candidates = resolvePageFileCandidates(pageKey || `page-${index + 1}`)
      .map((candidate) => `${templateFolder}/${candidate}`);

    let pageJson: Record<string, unknown> | null = null;
    for (const candidate of candidates) {
      pageJson = await readZipJson<Record<string, unknown>>(zip, candidate);
      if (pageJson) break;
    }

    const content = pageJson || (typeof pageEntry === "object" && pageEntry ? pageEntry as Record<string, unknown> : {});
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
          content: normalizeJson(blockRecord.content || blockRecord.props, {}),
          settings: normalizeJson(blockRecord.settings, {}),
          sort_order: typeof blockRecord.sort_order === "number" ? blockRecord.sort_order : blockIndex,
        };
      }),
    });
  }

  const unsupportedBlockTypes = findUnsupportedBlockTypes(pages);

  if (unsupportedBlockTypes.length > 0) {
    throw new TemplateImportError(
      `Unsupported block type(s): ${unsupportedBlockTypes.join(", ")}`,
      { status: 400, code: "UNSUPPORTED_BLOCK_TYPE" },
    );
  }

  const themeJson = (await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/styles/theme.json`)) || {};
  const cmsMappingJson = (await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/styles/cms-mapping.json`))
    || (await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/cms-mapping.json`))
    || {};

  const rawContentModes = await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/content/content-modes.json`);
  let contentModes: ImportedTemplateContent["contentModes"] = null;

  if (rawContentModes) {
    const rawModes = Array.isArray(rawContentModes.modes)
      ? (rawContentModes.modes as Array<Record<string, unknown>>)
      : [];
    const modes = rawModes
      .map((entry) => ({
        mode: String(entry.mode || "").trim().toLowerCase(),
        file: typeof entry.file === "string" ? entry.file : undefined,
        label: typeof entry.label === "string" ? entry.label : undefined,
        description: typeof entry.description === "string" ? entry.description : undefined,
      }))
      .filter((entry) => entry.mode === "demo" || entry.mode === "empty" || entry.mode === "ai");

    const defaultModeRaw = String(rawContentModes.defaultMode || "demo").trim().toLowerCase();
    const defaultMode = modes.some((entry) => entry.mode === defaultModeRaw)
      ? defaultModeRaw
      : (modes[0]?.mode || "demo");

    const seeds: Record<string, unknown> = {};
    for (const mode of modes) {
      if (!mode.file) continue;
      const seed = await readZipJson<Record<string, unknown>>(zip, `${templateFolder}/content/${mode.file}`);
      if (seed) {
        seeds[mode.mode] = seed;
      }
    }

    if (modes.length > 0) {
      contentModes = { defaultMode, modes, seeds };
    }
  }

  return { manifest, pages, themeJson, cmsMappingJson, contentModes };
}

async function safeDeleteTemplateChildren(templateId: string): Promise<void> {
  await supabaseAdmin.from("template_versions").delete().eq("template_id", templateId);
  await supabaseAdmin.from("website_template_blocks").delete().eq("template_id", templateId);
  await supabaseAdmin.from("website_template_pages").delete().eq("template_id", templateId);
}

function buildImportPages(manifest: unknown): TemplatePageManifest[] {
  const pages = Array.isArray(manifest)
    ? manifest
    : Array.isArray((manifest as { pages?: unknown }).pages)
      ? (manifest as { pages: unknown[] }).pages
      : [];

  return pages.map((page, index) => {
    const entry = typeof page === "string" ? { slug: page.replace(/\.json$/i, "") } : (page as Record<string, unknown>);
    const slug = String(entry.slug || entry.file || entry.filename || entry.path || `page-${index + 1}`).replace(/\.json$/i, "");
    const title = String(entry.title || slug.replace(/-/g, " ")).trim() || slug;
    const path = String(entry.path || entry.file || entry.filename || `${slug}.json`);
    const pageType = String(entry.page_type || entry.pageType || (slug === "home" ? "home" : "custom"));
    const sortOrder = typeof entry.sort_order === "number" ? entry.sort_order : index;
    const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];

    return {
      slug,
      title,
      path,
      page_type: pageType,
      sort_order: sortOrder,
      seo: normalizeJson(entry.seo, {}),
      settings: normalizeJson(entry.settings, {}),
      blocks: blocks.map((block, blockIndex) => {
        const blockRecord = block as Record<string, unknown>;
        const blockType = String(blockRecord.type || blockRecord.block_type || "text").trim();
        return {
          type: blockType,
          block_type: blockType,
          label: typeof blockRecord.label === "string" ? blockRecord.label : undefined,
          content: normalizeJson(blockRecord.content || blockRecord.props, {}),
          settings: normalizeJson(blockRecord.settings, {}),
          sort_order: typeof blockRecord.sort_order === "number" ? blockRecord.sort_order : blockIndex,
        };
      }),
    };
  });
}

async function upsertTemplateGraph(opts: {
  templateId: string;
  manifest: TemplateManifest;
  pages: TemplatePageManifest[];
  themeJson: Record<string, unknown>;
  cmsMappingJson: Record<string, unknown>;
  contentModes?: ImportedTemplateContent["contentModes"];
  validationReport: ReturnType<typeof buildValidationEnvelope>;
  uploadId: string;
  checksum: string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  originalZipMetadata: Record<string, unknown>;
  userId?: string;
}): Promise<{ templateId: string }> {
  const existingTemplate = await supabaseAdmin
    .from("website_templates")
    .select("id, version")
    .eq("slug", opts.manifest.slug)
    .maybeSingle();

  const templateId = existingTemplate.data?.id || opts.templateId;
  const templateVersion = existingTemplate.data?.version
    ? Number(existingTemplate.data.version) + 1
    : typeof opts.manifest.version === "number"
      ? opts.manifest.version
      : 1;

  if (existingTemplate.data?.id) {
    await safeDeleteTemplateChildren(existingTemplate.data.id);
  }

  const templateRecord = {
    id: templateId,
    name: opts.manifest.name,
    slug: opts.manifest.slug,
    description: opts.manifest.description || null,
    category: opts.manifest.category || "general",
    version: templateVersion,
    status: opts.validationReport.valid ? "validated" : "failed",
    is_active: false,
    is_featured: false,
    sort_order: 0,
    created_by: opts.userId || null,
    source_upload_id: opts.uploadId,
    template_json: opts.manifest,
    theme_json: opts.themeJson,
    cms_mapping_json: opts.cmsMappingJson,
    default_theme: opts.themeJson,
    default_pages: opts.pages,
    source: {
      import_type: "admin_zip_upload",
      ...(opts.contentModes ? { content_modes: opts.contentModes } : {}),
    },
    design_tokens: {},
    figma_export_info: {
      import_type: "zip",
      validation_report: opts.validationReport,
      original_zip_metadata: opts.originalZipMetadata,
      storage_bucket: TEMPLATE_PACKAGE_BUCKET,
      storage_path: opts.storagePath,
      file_name: opts.fileName,
      file_size_bytes: opts.fileSizeBytes,
      checksum_sha256: opts.checksum,
      mime_type: opts.mimeType,
    },
  };

  const { error: templateError } = await supabaseAdmin
    .from("website_templates")
    .upsert(templateRecord, { onConflict: "slug" });

  if (templateError) {
    throw templateError;
  }

  const { data: savedTemplate, error: templateLookupError } = await supabaseAdmin
    .from("website_templates")
    .select("id")
    .eq("slug", opts.manifest.slug)
    .single();

  if (templateLookupError || !savedTemplate) {
    throw templateLookupError || new Error("Failed to reload template after upsert");
  }

  const pageInserts = opts.pages.map((page) => ({
    template_id: savedTemplate.id,
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

  if (pagesError) {
    throw pagesError;
  }

  const pageIdBySlug = new Map((insertedPages || []).map((page) => [page.slug, page.id]));
  const blockInserts = opts.pages.flatMap((page) => {
    const pageId = pageIdBySlug.get(page.slug);
    if (!pageId) return [];
    return page.blocks.map((block) => ({
      template_id: savedTemplate.id,
      page_id: pageId,
      block_type: block.block_type || block.type,
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
      throw blocksError;
    }
  }

  const versionRecord = {
    id: uuidv4(),
    template_id: savedTemplate.id,
    version: templateVersion,
    design_tokens: opts.themeJson,
    demo_pages: opts.pages,
    release_notes: `Imported from ${opts.fileName}`,
  };

  const { error: versionError } = await supabaseAdmin.from("template_versions").insert(versionRecord);
  if (versionError) {
    throw versionError;
  }

  if (!opts.uploadId) {
    return { templateId: savedTemplate.id };
  }

  const uploadUpdate = {
    template_id: savedTemplate.id,
    validation_status: opts.validationReport.valid ? "validated" : "failed",
    validation_errors: opts.validationReport.valid ? [] : opts.validationReport.errors,
    validated_at: opts.validationReport.valid ? new Date().toISOString() : null,
    failed_at: opts.validationReport.valid ? null : new Date().toISOString(),
  };

  const { error: uploadUpdateError } = await supabaseAdmin
    .from("website_template_uploads")
    .update(uploadUpdate)
    .eq("id", opts.uploadId);

  if (uploadUpdateError) {
    throw uploadUpdateError;
  }

  return { templateId: savedTemplate.id };
}

function buildValidationEnvelope(validation: Awaited<ReturnType<typeof validateTemplateZip>>) {
  return {
    valid: validation.valid,
    templateSlug: validation.templateSlug,
    templateName: validation.templateName,
    pagesFound: validation.pagesFound,
    blocksFound: validation.blocksFound,
    warnings: validation.warnings,
    errors: validation.errors,
  };
}

router.post(
  "/admin/website-templates/upload",
  requireAuth,
  requireSuperAdmin,
  (req, res, next) => upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse upload" });
  }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      try {
        ensureZipFile(req.file);
      } catch (error) {
        await insertTemplateAuditLog({
          actorId: req.userId,
          actorEmail: req.userEmail,
          eventType: "website_template_upload_rejected",
          detail: { reason: error instanceof Error ? error.message : "Invalid upload" },
        });
        res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid upload",
          code: "INVALID_ZIP",
        });
        return;
      }

      await insertTemplateAuditLog({
        actorId: req.userId,
        actorEmail: req.userEmail,
        eventType: "website_template_upload_started",
        detail: {
          file_name: req.file.originalname,
          mime_type: req.file.mimetype || "application/zip",
          file_size_bytes: req.file.size,
        },
      });

      let uploadId = uuidv4();
      let storagePath = `template-packages/${uploadId}/original.zip`;
      const checksumSha256 = createHash("sha256").update(req.file.buffer).digest("hex");
      let shouldInsertUploadRow = true;
      let shouldUploadToStorage = true;

      const { data: existingUpload, error: existingUploadError } = await supabaseAdmin
        .from("website_template_uploads")
        .select("id, template_id, validation_status, validation_errors, original_zip_metadata, storage_path")
        .eq("checksum_sha256", checksumSha256)
        .maybeSingle();

      if (existingUploadError) {
        if (isMissingTemplateUploadsTableError(existingUploadError)) {
          await insertTemplateAuditLog({
            actorId: req.userId,
            actorEmail: req.userEmail,
            eventType: "website_template_upload_failed",
            detail: {
              file_name: req.file.originalname,
              code: "MISSING_TEMPLATE_UPLOADS_TABLE",
              error: "The website_template_uploads table is missing. Apply migration 0108_website_template_import_system.sql in Supabase.",
            },
          });
          res.status(503).json({
            error: "The website_template_uploads table is missing. Apply migration 0108_website_template_import_system.sql in Supabase.",
            code: "MISSING_TEMPLATE_UPLOADS_TABLE",
          });
          return;
        }
        throw existingUploadError;
      }

      if (existingUpload) {
        if (existingUpload.template_id) {
          const { data: existingTemplate } = await supabaseAdmin
            .from("website_templates")
            .select("id")
            .eq("id", existingUpload.template_id)
            .maybeSingle();

          if (existingTemplate) {
            const existingValidation = (existingUpload.original_zip_metadata as { validation?: unknown } | null)?.validation || null;
            await insertTemplateAuditLog({
              actorId: req.userId,
              actorEmail: req.userEmail,
              eventType: "website_template_upload_duplicate_detected",
              detail: {
                file_name: req.file.originalname,
                upload_id: existingUpload.id,
                template_id: existingUpload.template_id || null,
                checksum_sha256: checksumSha256,
              },
            });
            res.status(200).json({
              success: true,
              upload_id: existingUpload.id,
              template_id: existingUpload.template_id || null,
              validation: existingValidation || {
                valid: existingUpload.validation_status === "validated",
                templateSlug: null,
                templateName: null,
                pagesFound: [],
                blocksFound: 0,
                warnings: [],
                errors: existingUpload.validation_errors && Array.isArray(existingUpload.validation_errors) ? (existingUpload.validation_errors as string[]) : [],
              },
              duplicate: true,
            });
            return;
          }
        }

        uploadId = existingUpload.id;
        shouldInsertUploadRow = false;
        if (typeof existingUpload.storage_path === "string" && existingUpload.storage_path.length > 0) {
          storagePath = existingUpload.storage_path;
          shouldUploadToStorage = false;
        }

        await insertTemplateAuditLog({
          actorId: req.userId,
          actorEmail: req.userEmail,
          eventType: "website_template_upload_duplicate_reimport",
          detail: {
            file_name: req.file.originalname,
            upload_id: existingUpload.id,
            checksum_sha256: checksumSha256,
          },
        });
      }

      if (shouldUploadToStorage) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(TEMPLATE_PACKAGE_BUCKET)
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype || "application/zip",
            upsert: false,
          });

        if (storageError) {
          await insertTemplateAuditLog({
            actorId: req.userId,
            actorEmail: req.userEmail,
            eventType: "website_template_upload_failed",
            detail: {
              file_name: req.file.originalname,
              code: "STORAGE_UPLOAD_FAILED",
              storage_error: storageError.message,
            },
          });
          res.status(500).json({ error: `Failed to store uploaded ZIP: ${storageError.message}`, code: "STORAGE_UPLOAD_FAILED" });
          return;
        }
      }

      const validation = buildValidationEnvelope(await validateTemplateZip(req.file.buffer));
      const manifestSlug = validation.templateSlug || slugify(req.file.originalname.replace(/\.zip$/i, "")) || "template";
      let importedContent: ImportedTemplateContent = {
        manifest: {
          slug: manifestSlug,
          name: validation.templateName || req.file.originalname.replace(/\.zip$/i, "") || manifestSlug,
          description: typeof req.body?.description === "string" ? req.body.description : null,
          category: typeof req.body?.category === "string" ? req.body.category : null,
          version: 1,
        },
        pages: [] as TemplatePageManifest[],
        themeJson: {},
        cmsMappingJson: {},
      };

      if (validation.valid) {
        try {
          importedContent = await parseImportedTemplateContent(req.file.buffer, manifestSlug);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid template JSON";
          const code = error instanceof TemplateImportError ? error.code : "INVALID_TEMPLATE_JSON";
          await insertTemplateAuditLog({
            actorId: req.userId,
            actorEmail: req.userEmail,
            eventType: "website_template_validation_failed",
            detail: { file_name: req.file.originalname, code, message },
          });
          res.status(error instanceof TemplateImportError ? error.status : 400).json({ error: message, code });
          return;
        }
      } else {
        importedContent = {
          manifest: {
            slug: manifestSlug,
            name: validation.templateName || req.file.originalname.replace(/\.zip$/i, "") || manifestSlug,
            description: typeof req.body?.description === "string" ? req.body.description : null,
            category: typeof req.body?.category === "string" ? req.body.category : null,
            version: 1,
          },
          pages: [] as TemplatePageManifest[],
          themeJson: {},
          cmsMappingJson: {},
        };
      }

      if (shouldInsertUploadRow) {
        const { data: uploadRow, error: uploadInsertError } = await supabaseAdmin
          .from("website_template_uploads")
          .insert({
            id: uploadId,
            file_name: req.file.originalname,
            original_zip_metadata: {
              original_filename: req.file.originalname,
              validation,
            },
            storage_bucket: TEMPLATE_PACKAGE_BUCKET,
            storage_path: storagePath,
            checksum_sha256: checksumSha256,
            file_size_bytes: req.file.size,
            mime_type: req.file.mimetype || "application/zip",
            validation_status: validation.valid ? "validating" : "failed",
            validation_errors: validation.errors,
            created_by: req.userId,
          })
          .select("id")
          .single();

        if (uploadInsertError || !uploadRow) {
          await insertTemplateAuditLog({
            actorId: req.userId,
            actorEmail: req.userEmail,
            eventType: "website_template_upload_failed",
            detail: {
              file_name: req.file.originalname,
              code: "DB_TRANSACTION_FAILED",
              error: uploadInsertError?.message || "Failed to create upload record",
            },
          });
          res.status(500).json({ error: uploadInsertError?.message || "Failed to create upload record", code: "DB_TRANSACTION_FAILED" });
          return;
        }
      } else {
        const { error: uploadUpdateError } = await supabaseAdmin
          .from("website_template_uploads")
          .update({
            file_name: req.file.originalname,
            original_zip_metadata: {
              original_filename: req.file.originalname,
              validation,
            },
            storage_bucket: TEMPLATE_PACKAGE_BUCKET,
            storage_path: storagePath,
            checksum_sha256: checksumSha256,
            file_size_bytes: req.file.size,
            mime_type: req.file.mimetype || "application/zip",
            validation_status: validation.valid ? "validating" : "failed",
            validation_errors: validation.errors,
            validated_at: null,
            failed_at: validation.valid ? null : new Date().toISOString(),
            template_id: null,
          })
          .eq("id", uploadId);

        if (uploadUpdateError) {
          await insertTemplateAuditLog({
            actorId: req.userId,
            actorEmail: req.userEmail,
            eventType: "website_template_upload_failed",
            detail: {
              file_name: req.file.originalname,
              code: "DB_TRANSACTION_FAILED",
              error: uploadUpdateError.message,
            },
          });
          res.status(500).json({ error: uploadUpdateError.message, code: "DB_TRANSACTION_FAILED" });
          return;
        }
      }

      if (!validation.valid) {
        await supabaseAdmin
          .from("website_template_uploads")
          .update({ validation_status: "failed", validation_errors: validation.errors, failed_at: new Date().toISOString() })
          .eq("id", uploadId);

        await insertTemplateAuditLog({
          actorId: req.userId,
          actorEmail: req.userEmail,
          eventType: "website_template_validation_failed",
          detail: {
            upload_id: uploadId,
            file_name: req.file.originalname,
            code: "VALIDATION_FAILED",
            validation_errors: validation.errors,
          },
        });

        res.status(400).json({
          success: false,
          upload_id: uploadId,
          validation,
          code: "VALIDATION_FAILED",
        });
        return;
      }

      // Warn about truly unsupported block types (not mapped via aliases)
      if (validation.unsupportedBlockTypes && validation.unsupportedBlockTypes.length > 0) {
        validation.warnings.push(
          `⚠️ Unsupported block types found: ${validation.unsupportedBlockTypes.join(", ")}. These blocks will not render correctly in previews.`
        );
      }

      // Info about mapped block types
      if (validation.mappedBlockTypes && validation.mappedBlockTypes.length > 0) {
        validation.warnings.push(
          `ℹ️ Block types mapped to compatible renderers: ${validation.mappedBlockTypes.join(", ")}. These may render differently than intended.`
        );
      }

      let importResult: { templateId: string };
      try {
        importResult = await upsertTemplateGraph({
        templateId: uuidv4(),
        manifest: {
          ...importedContent.manifest,
          description: typeof req.body?.description === "string" ? req.body.description : importedContent.manifest.description,
          category: typeof req.body?.category === "string" ? req.body.category : importedContent.manifest.category,
        },
        pages: importedContent.pages,
        themeJson: importedContent.themeJson,
        cmsMappingJson: importedContent.cmsMappingJson,
        contentModes: importedContent.contentModes,
        validationReport: validation,
        uploadId,
        checksum: checksumSha256,
        fileName: req.file.originalname,
        storagePath,
        fileSizeBytes: req.file.size,
        mimeType: req.file.mimetype || "application/zip",
          originalZipMetadata: { original_filename: req.file.originalname, validation, import_source: "admin_website_templates" },
        userId: req.userId,
      });
      } catch (error) {
        if (isMissingTemplateImportSchemaError(error)) {
          const migrationMessage = "The template import schema is incomplete. Apply migration 0108_website_template_import_system.sql in Supabase.";
          await insertTemplateAuditLog({
            actorId: req.userId,
            actorEmail: req.userEmail,
            eventType: "website_template_import_failed",
            detail: {
              upload_id: uploadId,
              file_name: req.file.originalname,
              code: "MISSING_TEMPLATE_IMPORT_SCHEMA",
              error: error instanceof Error ? error.message : migrationMessage,
            },
          });
          res.status(503).json({ error: migrationMessage, code: "MISSING_TEMPLATE_IMPORT_SCHEMA" });
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to import template";
        await insertTemplateAuditLog({
          actorId: req.userId,
          actorEmail: req.userEmail,
          eventType: "website_template_import_failed",
          detail: {
            upload_id: uploadId,
            file_name: req.file.originalname,
            code: "DB_TRANSACTION_FAILED",
            error: message,
          },
        });
        res.status(500).json({ error: message, code: "DB_TRANSACTION_FAILED" });
        return;
      }

      await supabaseAdmin
        .from("website_template_uploads")
        .update({ validation_status: "validated", validation_errors: [], validated_at: new Date().toISOString(), template_id: importResult.templateId })
        .eq("id", uploadId);

      await insertTemplateAuditLog({
        actorId: req.userId,
        actorEmail: req.userEmail,
        eventType: "website_template_imported",
        entityId: importResult.templateId,
        detail: {
          upload_id: uploadId,
          file_name: req.file.originalname,
          page_count: importedContent.pages.length,
          block_count: importedContent.pages.reduce((acc, page) => acc + page.blocks.length, 0),
        },
      });

      res.status(201).json({
        success: true,
        upload_id: uploadId,
        template_id: importResult.templateId,
        validation,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload template ZIP";
      await insertTemplateAuditLog({
        actorId: req.userId,
        actorEmail: req.userEmail,
        eventType: "website_template_upload_failed",
        detail: { code: "IMPORT_FAILED", error: message },
      });
      res.status(500).json({ error: message, code: "IMPORT_FAILED" });
    }
  }
);

router.get("/admin/website-templates", requireAuth, requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("website_templates")
    .select("id, name, slug, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const templates = await Promise.all((data || []).map(async (template) => {
    const latestUploadResult = await getLatestTemplateUpload(template.id, "id, created_at");
    const [{ count: pagesCount }, { count: blocksCount }] = await Promise.all([
      supabaseAdmin.from("website_template_pages").select("id", { count: "exact", head: true }).eq("template_id", template.id),
      supabaseAdmin.from("website_template_blocks").select("id", { count: "exact", head: true }).eq("template_id", template.id),
    ]);

    return {
      ...template,
      status: normalizeTemplateStatus(template as TemplateRow),
      page_count: pagesCount || 0,
      block_count: blocksCount || 0,
      uploaded_at: latestUploadResult.data?.created_at || template.created_at,
    };
  }));

  res.json(templates);
});

router.get("/admin/website-templates/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: template, error } = await supabaseAdmin
    .from("website_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const normalizedTemplate = {
    ...template,
    status: normalizeTemplateStatus(template as TemplateRow),
  };

  // demo_pages is a preview structure
  let demoPages = template.demo_pages || [];

  // If demo_pages is empty (template created before the fix), fetch from conversion
  if (demoPages.length === 0 && template.slug) {
    try {
      const { data: conversion } = await supabaseAdmin
        .from("template_conversions")
        .select("block_mapping_report")
        .eq("template_slug", template.slug)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversion?.block_mapping_report) {
        const blockMapping = conversion.block_mapping_report as any;
        const pages = blockMapping.pages || {};

        // Reconstruct demo_pages from block_mapping_report
        demoPages = Object.entries(pages).map(([slug, blockTypes]: [string, any], idx: number) => ({
          slug,
          title: slug.charAt(0).toUpperCase() + slug.slice(1),
          block_count: (Array.isArray(blockTypes) ? blockTypes : []).length,
          block_types: Array.isArray(blockTypes) ? blockTypes : [],
        }));
      }
    } catch {
      // Silently fail - demo_pages will remain empty
    }
  }

  // Parse demo_pages into pages/blocks format for display
  const pages = demoPages.map((page: any, idx: number) => ({
    id: `preview-${idx}`,
    template_id: id,
    slug: page.slug,
    title: page.title,
    sort_order: idx,
  }));

  const blocks: any[] = [];
  (demoPages || []).forEach((page: any, pageIdx: number) => {
    (page.block_types || []).forEach((blockType: string, blockIdx: number) => {
      blocks.push({
        id: `preview-${pageIdx}-${blockIdx}`,
        page_id: `preview-${pageIdx}`,
        template_id: id,
        block_type: blockType,
        sort_order: blockIdx,
      });
    });
  });

  const latestUploadResult = await getLatestTemplateUpload(id);
  const { data: versionsResult } = await supabaseAdmin
    .from("template_versions")
    .select("*")
    .eq("template_id", id)
    .order("version", { ascending: false });

  res.json({
    template: normalizedTemplate,
    pages,
    blocks,
    upload: latestUploadResult.data || null,
    versions: versionsResult || [],
    validation_report: (latestUploadResult.data as { original_zip_metadata?: { validation?: unknown } } | null)?.original_zip_metadata?.validation || null,
  });
});

router.get("/admin/website-templates/:id/preview-data", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: template, error } = await supabaseAdmin
    .from("website_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const normalizedTemplate = {
    ...template,
    status: normalizeTemplateStatus(template as TemplateRow),
  };

  const latestUploadResult = await getLatestTemplateUpload(id);
  const [pagesResult, blocksResult] = await Promise.all([
    supabaseAdmin.from("website_template_pages").select("*").eq("template_id", id).order("sort_order", { ascending: true }),
    supabaseAdmin.from("website_template_blocks").select("*").eq("template_id", id).order("sort_order", { ascending: true }),
  ]);

  const validation = (latestUploadResult.data as { original_zip_metadata?: { validation?: unknown } } | null)?.original_zip_metadata?.validation || null;

  res.json({
    template: normalizedTemplate,
    theme: (template as Record<string, unknown>).theme_json || (template as Record<string, unknown>).default_theme || {},
    pages: pagesResult.data || [],
    blocks: blocksResult.data || [],
    upload: latestUploadResult.data || null,
    validation_report: validation,
  });
});

router.post("/admin/website-templates/:id/publish", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { data: template, error } = await supabaseAdmin
    .from("website_templates")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (error || !template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const uploadResult = await getLatestTemplateUpload(id, "validation_status, validation_errors");

  if (uploadResult.missingTable) {
    res.status(503).json({
      error: "The website_template_uploads table is missing. Apply migration 0108_website_template_import_system.sql in Supabase.",
      code: "MISSING_TEMPLATE_UPLOADS_TABLE",
    });
    return;
  }

  const uploadRow = uploadResult.data;

  if (uploadRow?.validation_status !== "validated") {
    res.status(400).json({ error: "Template cannot be published until validation passes" });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("website_templates")
    .update({
      status: "published",
      is_active: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  await insertTemplateAuditLog({
    actorId: authReq.userId,
    actorEmail: authReq.userEmail,
    eventType: "website_template_published",
    entityId: id,
    detail: { latest_upload_validation_status: uploadRow?.validation_status || null },
  });

  res.json({ success: true });
});

router.post("/admin/website-templates/:id/archive", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { error } = await supabaseAdmin
    .from("website_templates")
    .update({
      status: "draft",
      is_active: false,
    })
    .eq("id", id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await insertTemplateAuditLog({
    actorId: authReq.userId,
    actorEmail: authReq.userEmail,
    eventType: "website_template_archived",
    entityId: id,
  });

  res.json({ success: true });
});

router.delete("/admin/website-templates/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { data: template, error: templateError } = await supabaseAdmin
    .from("website_templates")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();

  if (templateError || !template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  await safeDeleteTemplateChildren(id);

  const { error: deleteError } = await supabaseAdmin
    .from("website_templates")
    .delete()
    .eq("id", id);

  if (deleteError) {
    const errorCode = (deleteError as { code?: string }).code;
    if (errorCode === "23503") {
      res.status(409).json({ error: "Template is currently in use and cannot be deleted" });
      return;
    }
    res.status(500).json({ error: deleteError.message });
    return;
  }

  await insertTemplateAuditLog({
    actorId: authReq.userId,
    actorEmail: authReq.userEmail,
    eventType: "website_template_delete_requested",
    entityId: id,
    detail: { deleted: true, archived: false, name: template.name, slug: template.slug },
  });

  res.json({ success: true, deleted: true, archived: false });
});

export default router;
