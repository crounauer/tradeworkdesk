import { mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

import { Router, type Request, type Response } from "express";
import multer from "multer";

import { requireSuperAdmin } from "../middlewares/auth";
import { extractTemplateZip } from "../templates/safeZipExtract";
import { readTemplatePackage } from "../templates/readTemplatePackage";
import { importTemplatePackage } from "../templates/importTemplatePackage";

const router = Router();

const uploadRoot = join(tmpdir(), "twd-template-uploads");
mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  dest: uploadRoot,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".zip")) {
      callback(new Error("Only .zip template packages are allowed"));
      return;
    }

    callback(null, true);
  },
});

/**
 * POST /api/superadmin/template-imports/import
 *
 * Imports a TWD upload-ready template ZIP package.
 * Always imports as draft.
 */
router.post(
  "/superadmin/template-imports/import",
  requireSuperAdmin,
  upload.single("templateZip"),
  async (req: Request, res: Response) => {
    const uploadedFile = req.file;
    let extractionDir: string | null = null;

    try {
      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: 'Missing required file field "templateZip"',
        });
      }

      extractionDir = await mkdtemp(join(tmpdir(), "twd-template-extract-"));

      await extractTemplateZip(uploadedFile.path, extractionDir);

      const packageData = await readTemplatePackage(extractionDir);

      const result = await importTemplatePackage(packageData, {
        sourceFilename: basename(uploadedFile.originalname),
        importedBy: null,
        publish: false,
      });

      return res.json({
        success: true,
        templateSlug: result.templateSlug,
        templateName: result.templateName,
        status: result.status,
        importedPages: result.importedPages,
        importedBlocks: result.importedBlocks,
        importedBlockTypes: result.importedBlockTypes,
        importId: result.importId,
      });
    } catch (error) {
      console.error("[superadmin-template-imports] Import failed:", error);

      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (uploadedFile?.path) {
        await rm(uploadedFile.path, { force: true }).catch(() => undefined);
      }

      if (extractionDir) {
        await rm(extractionDir, { recursive: true, force: true }).catch(
          () => undefined
        );
      }
    }
  }
);

export default router;
