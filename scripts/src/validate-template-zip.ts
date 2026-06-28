#!/usr/bin/env node
/**
 * CLI: Validate TWD Template ZIP Package
 *
 * Usage:
 *   pnpm --filter @workspace/scripts validate-template-zip /path/to/template.zip
 *   or from root: pnpm exec tsx scripts/src/validate-template-zip.ts /path/to/template.zip
 *
 * Validates a template ZIP without importing to database
 * Exits with code 0 on success, 1 on validation failure
 */

import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("❌ Usage: pnpm --filter @workspace/scripts validate-template-zip <path/to/template.zip>");
  console.error("   or: tsx scripts/src/validate-template-zip.ts <path/to/template.zip>");
  process.exit(1);
}

const zipPath = args[0];

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(message: string, color?: string) {
  if (color) {
    console.log(`${color}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

function normalizeJson<T>(value: unknown, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

/**
 * Read JSON from ZIP file
 */
async function readZipJson<T>(zip: JSZip, filepath: string): Promise<T | null> {
  try {
    const file = zip.file(filepath);
    if (!file) return null;
    const content = await file.async("text");
    return JSON.parse(content) as T;
  } catch (error) {
    return null;
  }
}

/**
 * Main validation function
 */
async function validateTemplate(): Promise<void> {
  try {
    // Resolve absolute path
    const absolutePath = path.resolve(zipPath);

    // Check if file exists
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      log(`❌ Error: ${absolutePath} is not a file`, colors.red);
      process.exit(1);
    }

    log(`\n📦 Validating: ${absolutePath}`, colors.cyan);
    log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Read ZIP file
    const zipBuffer = await fs.readFile(absolutePath);

    // Extract ZIP
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch (error) {
      log(`❌ Invalid ZIP archive`, colors.red);
      process.exit(1);
    }

    // List ZIP contents for debugging
    const files = Object.keys(zip.files);
    log(`   Contains ${files.length} files/directories`, colors.dim);

    // Find template folder (should be templates/{slug})
    const templateFolders = files
      .filter((f) => f.startsWith("templates/") && f.split("/").length >= 2)
      .map((f) => f.split("/")[1])
      .filter((slug, i, arr) => arr.indexOf(slug) === i);

    if (templateFolders.length === 0) {
      log(`❌ No template found (expected templates/{slug}/ folder structure)`, colors.red);
      process.exit(1);
    }

    const manifestSlug = templateFolders[0];
    const templateFolder = `templates/${manifestSlug}`;

    log(`\n✓ Template folder: ${templateFolder}\n`);

    // Read template manifest
    type TemplateManifest = {
      slug: string;
      name: string;
      description?: string | null;
      category?: string | null;
      version?: number | string | null;
    };

    const manifest = (await readZipJson<TemplateManifest>(zip, `${templateFolder}/template.json`)) || {
      slug: manifestSlug,
      name: manifestSlug,
      description: null,
      category: null,
      version: 1,
    };

    log(`${colors.green}✓ Manifest:`, colors.reset);
    log(`  Slug: ${manifest.slug}`);
    log(`  Name: ${manifest.name}`);
    if (manifest.description) log(`  Description: ${manifest.description}`);
    if (manifest.category) log(`  Category: ${manifest.category}`);
    if (manifest.version) log(`  Version: ${manifest.version}`);

    // Read pages
    const rawPages = await readZipJson<{ pages?: unknown } | unknown[]>(
      zip,
      `${templateFolder}/pages/pages.json`,
    );
    const pageEntries = Array.isArray(rawPages)
      ? rawPages
      : Array.isArray(rawPages?.pages)
        ? rawPages.pages
        : [];

    log(`\n${colors.green}✓ Pages: ${pageEntries.length}`, colors.reset);

    // Parse each page
    let totalBlocks = 0;
    const blockTypes = new Set<string>();

    for (let index = 0; index < pageEntries.length; index += 1) {
      const pageEntry = pageEntries[index];
      const pageKey =
        typeof pageEntry === "string"
          ? pageEntry
          : String(
              (pageEntry as Record<string, unknown>).slug ||
                (pageEntry as Record<string, unknown>).file ||
                (pageEntry as Record<string, unknown>).filename ||
                (pageEntry as Record<string, unknown>).path ||
                "",
            );

      // Try multiple file name candidates
      const candidates = [
        `${templateFolder}/pages/${pageKey}`,
        `${templateFolder}/pages/${pageKey}.json`,
        `${templateFolder}/${pageKey}`,
        `${templateFolder}/${pageKey}.json`,
      ].filter((c, i, arr) => arr.indexOf(c) === i);

      let pageJson: Record<string, unknown> | null = null;
      for (const candidate of candidates) {
        pageJson = await readZipJson<Record<string, unknown>>(zip, candidate);
        if (pageJson) break;
      }

      const content =
        pageJson ||
        (typeof pageEntry === "object" && pageEntry ? (pageEntry as Record<string, unknown>) : {});
      const slug = String(content.slug || pageKey || `page-${index + 1}`).replace(/\.json$/i, "");
      const title = String(content.title || slug.replace(/-/g, " ")).trim() || slug;
      const blocks = Array.isArray(content.blocks) ? content.blocks : [];

      log(`  [${index + 1}] ${title} (${slug})`, colors.dim);
      log(`      Blocks: ${blocks.length}`);

      // Collect block types
      blocks.forEach((block) => {
        const blockRecord = block as Record<string, unknown>;
        const blockType = String(blockRecord.type || blockRecord.block_type || "text").trim() || "text";
        blockTypes.add(blockType);
      });

      totalBlocks += blocks.length;
    }

    // Print summary
    log(`\n${colors.green}✓ Summary:`, colors.reset);
    log(`  Pages: ${pageEntries.length}`);
    log(`  Total Blocks: ${totalBlocks}`);
    log(`  Block Types Used (${blockTypes.size}):`);
    Array.from(blockTypes)
      .sort()
      .forEach((type) => {
        log(`    • ${type}`, colors.dim);
      });

    // Check for theme and cms-mapping files
    const hasTheme = await readZipJson(zip, `${templateFolder}/styles/theme.json`);
    const hasCmsMapping =
      (await readZipJson(zip, `${templateFolder}/styles/cms-mapping.json`)) ||
      (await readZipJson(zip, `${templateFolder}/cms-mapping.json`));

    log(`\n${colors.green}✓ Optional Files:`, colors.reset);
    log(`  Theme: ${hasTheme ? "✓" : "✗"}`);
    log(`  CMS Mapping: ${hasCmsMapping ? "✓" : "✗"}`);

    // Success
    log(`\n${colors.green}✅ Template ZIP is valid and ready to import`, colors.reset);
    log("");
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\n${colors.red}❌ Validation failed: ${message}${colors.reset}\n`, colors.red);
    process.exit(1);
  }
}

// Run validation
validateTemplate().catch((error) => {
  console.error(error);
  process.exit(1);
});
