/**
 * Website Templates Routes
 * 
 * Express route handlers for website template management.
 * Integrated into TWD's Express app.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import unzipper from "unzipper";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import {
  websiteTemplateStorage,
  type InsertWebsiteTemplate,
  type InsertWebsite,
  type InsertWebsitePage,
} from "../lib/website-templates-storage";
import { requireAuth, requireSuperAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
const execAsync = promisify(exec);

// Track build status for templates (templateName -> status)
const templateBuildStatus = new Map<string, {
  status: 'idle' | 'building' | 'success' | 'failed';
  error?: string;
  completedAt?: Date;
}>();

// Configure multer for zip uploads (in memory, max 50MB)
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only zip files are allowed"));
    }
  },
});

/**
 * Helper to extract tenant ID from authenticated request
 */
function getTenantId(req: Request): string | undefined {
  const authReq = req as AuthenticatedRequest;
  return authReq.tenantId || (authReq as any).session?.tenantId;
}

/**
 * Helper to check if user is authenticated
 */
function requireTenantId(req: Request, res: Response, next: NextFunction): void {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(401).json({ error: "Unauthorized: tenant_id required" });
    return;
  }
  next();
}

const IGNORED_ZIP_ENTRIES = new Set(["__MACOSX", ".DS_Store"]);

/**
 * Build a template by running pnpm install and pnpm run build
 */
async function buildTemplate(templatePath: string, templateName: string): Promise<void> {
  templateBuildStatus.set(templateName, { status: 'building' });

  try {
    console.log(`[build] Starting build for template: ${templateName}`);
    
    // Check if package.json exists
    const packageJsonPath = path.join(templatePath, "package.json");
    const packageJsonExists = await fs.stat(packageJsonPath).catch(() => null);
    
    if (!packageJsonExists) {
      console.log(`[build] No package.json found for ${templateName}, skipping build`);
      templateBuildStatus.set(templateName, { status: 'success' });
      return;
    }

    // Run pnpm install
    console.log(`[build] Running pnpm install in ${templatePath}`);
    await execAsync("pnpm install", { cwd: templatePath, maxBuffer: 10 * 1024 * 1024 });
    
    // Run pnpm build with correct base path so asset URLs work when served at the preview URL
    const base = `/api/preview/templates/${templateName}/`;
    console.log(`[build] Running pnpm build in ${templatePath} (base: ${base})`);
    await execAsync(`pnpm run build --base="${base}"`, { cwd: templatePath, maxBuffer: 10 * 1024 * 1024 });

    // Post-process: rewrite any remaining absolute /assets/ paths in index.html to be relative.
    // This is a safety net in case --base didn't apply (e.g. template overrides vite.config).
    const distIndex = path.join(templatePath, "dist", "index.html");
    try {
      let html = await fs.readFile(distIndex, "utf-8");
      const rewritten = html
        .replace(/(src|href)="\/assets\//g, '$1="./assets/')
        .replace(/(src|href)=['\"]\/assets\//g, '$1="./assets/');
      if (rewritten !== html) {
        await fs.writeFile(distIndex, rewritten, "utf-8");
        console.log(`[build] Rewrote absolute asset paths in dist/index.html for ${templateName}`);
      }
    } catch {
      // index.html may not exist in some template types — ignore
    }
    
    templateBuildStatus.set(templateName, { 
      status: 'success',
      completedAt: new Date()
    });
    console.log(`[build] Successfully built template: ${templateName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[build] Failed to build template ${templateName}:`, errorMessage);
    templateBuildStatus.set(templateName, { 
      status: 'failed',
      error: errorMessage
    });
    throw error;
  }
}

async function extractZipBufferToDirectory(zipBuffer: Buffer, destinationRoot: string): Promise<void> {
  const archive = await unzipper.Open.buffer(zipBuffer);

  for (const entry of archive.files) {
    const normalizedPath = path.normalize(entry.path).replace(/^(\.\.(\/|\\|$))+/, "");
    const outputPath = path.join(destinationRoot, normalizedPath);
    const relativeOutputPath = path.relative(destinationRoot, outputPath);

    if (relativeOutputPath.startsWith("..") || path.isAbsolute(relativeOutputPath)) {
      throw new Error(`Invalid zip entry path: ${entry.path}`);
    }

    if (entry.type === "Directory") {
      await fs.mkdir(outputPath, { recursive: true });
      continue;
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const content = await entry.buffer();
    await fs.writeFile(outputPath, content);
  }
}

async function resolveExtractedTemplateSource(extractRoot: string, templateName: string): Promise<string> {
  const entries = await fs.readdir(extractRoot, { withFileTypes: true });
  const filteredEntries = entries.filter((entry) => !IGNORED_ZIP_ENTRIES.has(entry.name));

  const matchingDirectory = filteredEntries.find(
    (entry) => entry.isDirectory() && entry.name === templateName,
  );
  if (matchingDirectory) {
    return path.join(extractRoot, matchingDirectory.name);
  }

  if (filteredEntries.length === 1 && filteredEntries[0].isDirectory()) {
    return path.join(extractRoot, filteredEntries[0].name);
  }

  return extractRoot;
}

async function moveExtractedTemplate(sourceDir: string, destinationDir: string): Promise<void> {
  await fs.mkdir(destinationDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_ZIP_ENTRIES.has(entry.name)) {
      continue;
    }

    await fs.rename(
      path.join(sourceDir, entry.name),
      path.join(destinationDir, entry.name),
    );
  }
}

// ─── WEBSITE TEMPLATES (Public) ──────────────────────────────────────────────

/**
 * GET /api/templates - List all active templates
 */
router.get("/templates", async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await websiteTemplateStorage.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

/**
 * GET /api/templates/:id - Get a specific template
 */
router.get("/templates/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const template = await websiteTemplateStorage.getTemplate(id);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  } catch (error) {
    console.error("Get template error:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

/**
 * Helper to recursively list template files
 */
async function listTemplateFiles(dir: string, baseDir: string, maxDepth: number = 3, currentDepth: number = 0): Promise<any[]> {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (IGNORED_ZIP_ENTRIES.has(entry.name) || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        files.push({
          name: entry.name,
          type: "directory",
          path: relativePath,
          children: await listTemplateFiles(fullPath, baseDir, maxDepth, currentDepth + 1),
        });
      } else {
        const stat = await fs.stat(fullPath);
        files.push({
          name: entry.name,
          type: "file",
          path: relativePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    }

    return files.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

/**
 * GET /api/templates/:id/files - Get extracted template file structure
 */
router.get("/templates/:id/files", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    // Try to get template by ID first, then by name/slug if that fails
    let template = await websiteTemplateStorage.getTemplate(id).catch(() => null);
    if (!template) {
      template = await websiteTemplateStorage.getTemplateByName(id).catch(() => null);
    }

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    // Extract template path (it might be "templates/modern" or just "modern")
    let templateDir = template.template_path || template.slug || template.name;
    if (!templateDir) {
      res.status(404).json({ error: "Template path not available" });
      return;
    }

    // Ensure it's relative to templates directory if not already
    if (!templateDir.startsWith("templates/")) {
      templateDir = `templates/${templateDir}`;
    }

    const fullPath = path.join(process.cwd(), templateDir);

    // Verify path exists and is within templates directory
    const realPath = await fs.realpath(fullPath).catch(() => null);
    if (!realPath || !realPath.includes("templates")) {
      res.status(404).json({ error: "Template files not found" });
      return;
    }

    const files = await listTemplateFiles(fullPath, fullPath);
    res.json({ templateId: id, templateName: template.display_name, files });
  } catch (error) {
    console.error("Get template files error:", error);
    res.status(500).json({ error: "Failed to fetch template files" });
  }
});

/**
 * POST /api/admin/templates - Create a new template (admin only)
 */
router.post("/admin/templates", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, displayName, description, version, templatePath, previewImageUrl } = req.body;

    if (!name || !displayName || !templatePath) {
      res
        .status(400)
        .json({ error: "Missing required fields: name, displayName, templatePath" });
      return;
    }

    // Check if template already exists
    const existing = await websiteTemplateStorage.getTemplateByName(name);
    if (existing) {
      res.status(409).json({ error: "Template with this name already exists" });
      return;
    }

    const template = await websiteTemplateStorage.createTemplate({
      name,
      display_name: displayName,
      description: description || null,
      version: version || "1.0.0",
      template_path: templatePath,
      preview_image_url: previewImageUrl || null,
      is_active: true,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Create template error:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

/**
 * PATCH /api/admin/templates/:id - Update a template
 */
router.patch("/admin/templates/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { displayName, description, version, templatePath, previewImageUrl, isActive } =
      req.body;

    const updated = await websiteTemplateStorage.updateTemplate(id, {
      display_name: displayName,
      description: description || null,
      version,
      template_path: templatePath,
      preview_image_url: previewImageUrl || null,
      is_active: isActive,
    });

    if (!updated) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Update template error:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

/**
 * DELETE /api/admin/templates/:id - Delete a template
 */
router.delete("/admin/templates/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    // Look up the template to get its name/slug before deleting
    const template = await websiteTemplateStorage.getTemplate(id);
    
    // Delete from database
    await websiteTemplateStorage.deleteTemplate(id);
    
    // Delete from disk if template folder exists
    if (template?.name) {
      const templatePath = path.join(process.cwd(), "templates", template.name);
      try {
        await fs.rm(templatePath, { recursive: true, force: true });
      } catch (diskError) {
        console.error(`Failed to delete template folder at ${templatePath}:`, diskError);
        // Continue anyway - database record is deleted
      }
    }
    
    res.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("Delete template error:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

/**
 * POST /api/admin/templates/upload - Upload template zip file
 * 
 * Expects:
 * - form-data with "zip" file field
 * - "name" field for template name (slug)
 * - "displayName" field for display name
 * - "description" field (optional)
 * 
 * The zip file should contain a folder structure matching the template name:
 * my-template.zip
 *   └── my-template/
 *       ├── index.html
 *       ├── components/
 *       ├── styles/
 *       └── ...
 */
router.post(
  "/admin/templates/upload",
  requireAuth,
  requireSuperAdmin,
  zipUpload.single("zip"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = (req as any).file;
      const { name, displayName, description, version } = req.body;

      // Validation
      if (!file) {
        res.status(400).json({ error: "No zip file provided" });
        return;
      }

      if (!file.buffer) {
        res.status(400).json({ error: "Invalid file buffer" });
        return;
      }

      const derivedName = String(name || file.originalname || "")
        .replace(/\.zip$/i, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      const derivedDisplayName = String(displayName || derivedName || file.originalname || "Template")
        .replace(/\.zip$/i, "")
        .trim()
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

      if (!derivedName) {
        res.status(400).json({ error: "Unable to derive a template name" });
        return;
      }

      // Get templates directory path
      const templatesDir = path.join(process.cwd(), "templates");

      // Extract zip to templates directory
      const extractPath = path.join(templatesDir, derivedName);
      const tempExtractPath = await fs.mkdtemp(path.join(templatesDir, ".template-upload-"));

      // Create directory if it doesn't exist
      await fs.mkdir(templatesDir, { recursive: true });

      // Remove existing template if it exists
      try {
        await fs.rm(extractPath, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, which is fine
      }

      try {
        // Extract zip file
        await extractZipBufferToDirectory(file.buffer, tempExtractPath);

        const sourcePath = await resolveExtractedTemplateSource(tempExtractPath, derivedName);
        await moveExtractedTemplate(sourcePath, extractPath);

        await fs.writeFile(
          path.join(extractPath, ".twd-uploaded.json"),
          JSON.stringify({
            name: derivedName,
            displayName: derivedDisplayName,
            uploadedAt: new Date().toISOString(),
          }, null, 2),
        );

        const extractedEntries = (await fs.readdir(extractPath)).filter(
          (entry) => !IGNORED_ZIP_ENTRIES.has(entry),
        );

        if (!extractedEntries.length) {
          res.status(400).json({
            error: `Template structure invalid. ZIP file did not contain any usable template files for '${derivedName}'.`,
          });
          return;
        }
      } finally {
        await fs.rm(tempExtractPath, { recursive: true, force: true });
      }

      // Check if template already exists
      const existing = await websiteTemplateStorage.getTemplateByName(derivedName);

      let template;
      if (existing) {
        // Update existing template
        template = await websiteTemplateStorage.updateTemplate(existing.id, {
          display_name: derivedDisplayName,
          description: description || null,
          version: version || "1.0.0",
          template_path: `templates/${derivedName}`,
                 is_active: true,
        });
        console.log(`[upload] Updated existing template: ${derivedName} (id: ${existing.id})`, { is_active: template?.is_active });
      } else {
        // Create new template
        template = await websiteTemplateStorage.createTemplate({
          name: derivedName,
          display_name: derivedDisplayName,
          description: description || null,
          version: version || "1.0.0",
          template_path: `templates/${derivedName}`,
          is_active: true,
        });
      }

      res.status(201).json({
        success: true,
        template,
        message: `Template '${derivedDisplayName}' uploaded and extracted successfully`,
        extractedTo: extractPath,
      });

      // Start build asynchronously (don't wait for it)
      buildTemplate(extractPath, derivedName).catch((error) => {
        console.error(`[upload] Build failed for ${derivedName}:`, error);
      });
    } catch (error) {
      console.error("Template upload error:", error);
      const errorMessage =
        error instanceof Error && error.message === "FILE_ENDED"
          ? "The uploaded file is not a valid ZIP archive or is corrupted"
          : error instanceof Error
            ? error.message
            : "Unknown error";
      res.status(500).json({ error: `Failed to upload template: ${errorMessage}` });
    }
  }
);

// ─── WEBSITES (Tenant-scoped) ────────────────────────────────────────────────

/**
 * GET /api/website - Get tenant's website
 */
router.get("/website", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const website = await websiteTemplateStorage.getWebsite(tenantId);

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    res.json(website);
  } catch (error) {
    console.error("Get website error:", error);
    res.status(500).json({ error: "Failed to fetch website" });
  }
});

/**
 * POST /api/website - Create website for tenant
 */
router.post("/website", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const { templateId, title, description, slug, customizations } = req.body;

    if (!templateId || !title || !slug) {
      res.status(400).json({ error: "Missing required fields: templateId, title, slug" });
      return;
    }

    // Verify template exists
    const template = await websiteTemplateStorage.getTemplate(templateId);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    // Check if website already exists for tenant
    const existing = await websiteTemplateStorage.getWebsite(tenantId);
    if (existing) {
      res.status(409).json({ error: "Website already exists for this tenant" });
      return;
    }

    const website = await websiteTemplateStorage.createWebsite({
      tenant_id: tenantId,
      template_id: templateId,
      title,
      description: description || null,
      slug,
      customizations: customizations ? JSON.stringify(customizations) : null,
    });

    res.status(201).json(website);
  } catch (error) {
    console.error("Create website error:", error);
    res.status(500).json({ error: "Failed to create website" });
  }
});

/**
 * PATCH /api/website - Update website settings
 */
router.patch("/website", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const { title, description, slug, customizations } = req.body;

    const updated = await websiteTemplateStorage.updateWebsite(tenantId, {
      title,
      description: description || null,
      slug,
      customizations: customizations ? JSON.stringify(customizations) : null,
    });

    if (!updated) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Update website error:", error);
    res.status(500).json({ error: "Failed to update website" });
  }
});

/**
 * POST /api/website/switch-template - Switch to a different template
 */
router.post("/website/switch-template", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const { templateId } = req.body;

    if (!templateId) {
      res.status(400).json({ error: "Missing required field: templateId" });
      return;
    }

    // Verify template exists
    const template = await websiteTemplateStorage.getTemplate(templateId);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const updated = await websiteTemplateStorage.switchTemplate(tenantId, templateId);

    if (!updated) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Switch template error:", error);
    res.status(500).json({ error: "Failed to switch template" });
  }
});

/**
 * POST /api/website/publish - Publish website
 */
router.post("/website/publish", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;

    const updated = await websiteTemplateStorage.publishWebsite(tenantId);

    if (!updated) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Publish website error:", error);
    res.status(500).json({ error: "Failed to publish website" });
  }
});

/**
 * POST /api/website/unpublish - Unpublish website
 */
router.post("/website/unpublish", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;

    const updated = await websiteTemplateStorage.unpublishWebsite(tenantId);

    if (!updated) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Unpublish website error:", error);
    res.status(500).json({ error: "Failed to unpublish website" });
  }
});

// ─── WEBSITE PAGES (Tenant-scoped) ──────────────────────────────────────────

/**
 * GET /api/website/pages - List tenant's website pages
 */
router.get("/website/pages", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const pages = await websiteTemplateStorage.getWebsitePages(tenantId);
    res.json(pages);
  } catch (error) {
    console.error("Get website pages error:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

/**
 * GET /api/website/pages/:slug - Get a specific page by slug
 */
router.get("/website/pages/:slug", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const page = await websiteTemplateStorage.getWebsitePage(tenantId, slug);

    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    res.json(page);
  } catch (error) {
    console.error("Get website page error:", error);
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

/**
 * POST /api/website/pages - Create a new page
 */
router.post("/website/pages", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const { title, slug, content, displayOrder, isVisible } = req.body;

    if (!title || !slug) {
      res.status(400).json({ error: "Missing required fields: title, slug" });
      return;
    }

    const page = await websiteTemplateStorage.createWebsitePage({
      tenant_id: tenantId,
      title,
      slug,
      content: content ? JSON.stringify(content) : null,
      display_order: displayOrder || 0,
      is_visible: isVisible !== false,
    });

    res.status(201).json(page);
  } catch (error) {
    console.error("Create website page error:", error);
    res.status(500).json({ error: "Failed to create page" });
  }
});

/**
 * PATCH /api/website/pages/:id - Update a page
 */
router.patch("/website/pages/:id", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, slug, content, displayOrder, isVisible } = req.body;

    const updated = await websiteTemplateStorage.updateWebsitePage(id, {
      title,
      slug,
      content: content ? JSON.stringify(content) : undefined,
      display_order: displayOrder,
      is_visible: isVisible,
    });

    if (!updated) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error("Update website page error:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
});

/**
 * DELETE /api/website/pages/:id - Delete a page
 */
router.delete("/website/pages/:id", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await websiteTemplateStorage.deleteWebsitePage(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete website page error:", error);
    res.status(500).json({ error: "Failed to delete page" });
  }
});

/**
 * PUT /api/website/pages/reorder - Reorder pages
 */
router.put("/api/website/pages/reorder", requireTenantId, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req)!;
    const { pages } = req.body;

    if (!Array.isArray(pages)) {
      res.status(400).json({ error: "Pages must be an array" });
      return;
    }

    const updated = await websiteTemplateStorage.reorderWebsitePages(tenantId, pages);
    res.json(updated);
  } catch (error) {
    console.error("Reorder website pages error:", error);
    res.status(500).json({ error: "Failed to reorder pages" });
  }
});

// ─── TEMPLATE PREVIEW & BUILD ───────────────────────────────────────────────

/**
 * GET /api/admin/template-builds/:name/status - Get build status for a template
 */
router.get("/admin/template-builds/:name/status", requireAuth, requireSuperAdmin, (req: Request, res: Response): void => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const status = templateBuildStatus.get(name) || { status: 'idle' };
  res.json(status);
});

/**
 * POST /api/admin/template-builds/:name - Trigger a build for an uploaded template
 */
router.post("/admin/template-builds/:name", requireAuth, requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const templatePath = path.join(process.cwd(), "templates", name);

  // Check the template exists on disk
  const markerPath = path.join(templatePath, ".twd-uploaded.json");
  try {
    await fs.access(markerPath);
  } catch {
    res.status(404).json({ error: `Template '${name}' not found or not uploaded` });
    return;
  }

  const current = templateBuildStatus.get(name);
  if (current?.status === 'building') {
    res.json({ message: "Build already in progress", status: current });
    return;
  }

  // Start build asynchronously
  buildTemplate(templatePath, name).catch((error) => {
    console.error(`[build] Build failed for ${name}:`, error);
  });

  res.json({ message: "Build started", status: { status: 'building' } });
});

export default router;
