#!/usr/bin/env node

import { promises as fs } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve, basename } from 'path';
import dotenv from 'dotenv';

// Load .env before any Supabase client code is imported.
// process.cwd() is the api-server package root when run via pnpm --filter.
dotenv.config({ path: resolve(process.cwd(), '.env') });

/**
 * CLI script to import a TWD template ZIP package into Supabase.
 *
 * Usage:
 *   tsx src/templates/importTemplateZipCli.ts path/to/template.zip
 *   tsx src/templates/importTemplateZipCli.ts path/to/template.zip --publish
 */
async function main() {
  // Dynamic imports ensure dotenv.config() has already run before any module
  // that initialises the Supabase client is evaluated.
  const { extractTemplateZip, validateZipFile, ZipExtractionError } = await import('./safeZipExtract');
  const { readTemplatePackage } = await import('./readTemplatePackage');
  const { importTemplatePackage } = await import('./importTemplatePackage');

  const args = process.argv.slice(2);
  const zipPath = args.find((a) => !a.startsWith('--'));
  const publish = args.includes('--publish');

  if (!zipPath) {
    console.error('Usage: tsx src/templates/importTemplateZipCli.ts <path/to/template.zip> [--publish]');
    process.exit(1);
  }

  const safeZipPath = resolve(zipPath);
  let tempDir: string | null = null;

  try {
    // Step 1: Verify ZIP file exists
    console.log(`\nImporting ZIP: ${safeZipPath}`);
    if (publish) {
      console.log('Mode: publish (template will be set to live)');
    } else {
      console.log('Mode: draft (use --publish to make live)');
    }

    try {
      await fs.stat(safeZipPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        console.error(`\n✗ Error: ZIP file not found: ${safeZipPath}\n`);
        process.exit(1);
      }
      throw error;
    }

    // Step 2: Pre-validate ZIP structure
    console.log('\nValidating ZIP structure...');
    try {
      await validateZipFile(safeZipPath);
    } catch (error) {
      const err = error as Error;
      console.error(`\n✗ ZIP validation failed:\n${err.message}\n`);
      process.exit(1);
    }

    // Step 3: Create temporary directory
    tempDir = await mkdtemp(join(tmpdir(), 'twd-import-'));

    // Step 4: Extract ZIP
    console.log('Extracting package...');
    try {
      await extractTemplateZip(safeZipPath, tempDir);
    } catch (error) {
      if (error instanceof ZipExtractionError) {
        console.error(`\n✗ Extraction failed [${error.code}]:\n${error.message}\n`);
      } else {
        const err = error as Error;
        console.error(`\n✗ Extraction failed:\n${err.message}\n`);
      }
      process.exit(1);
    }

    // Step 5: Read and validate package structure
    console.log('Validating package structure...');
    let packageData;
    try {
      packageData = await readTemplatePackage(tempDir);
    } catch (error) {
      const err = error as Error;
      console.error(`\n✗ Package validation failed:\n${err.message}\n`);
      process.exit(1);
    }

    // Step 6: Import into Supabase
    console.log('Importing into Supabase...');
    let result;
    try {
      result = await importTemplatePackage(packageData, {
        sourceFilename: basename(safeZipPath),
        importedBy: null,
        publish,
      });
    } catch (error) {
      const err = error as Error;
      console.error(`\n✗ Import failed:\n${err.message}\n`);
      process.exit(1);
    }

    // Step 7: Print import summary
    console.log('\n✓ Import successful!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Import Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Import ID:          ${result.importId}`);
    console.log(`  Slug:               ${result.templateSlug}`);
    console.log(`  Name:               ${result.templateName}`);
    console.log(`  Status:             ${result.status}`);
    console.log(`  Pages imported:     ${result.importedPages}`);
    console.log(`  Blocks imported:    ${result.importedBlocks}`);
    console.log(`  Block types:        ${result.importedBlockTypes}`);
    console.log(`  Block type names:   ${packageData.stats.blockTypes.join(', ')}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (result.status === 'draft') {
      console.log(`  Template is in draft. Run with --publish to make it live.\n`);
    } else {
      console.log(`  Template is live!\n`);
    }

    process.exit(0);

  } catch (error) {
    const err = error as Error;
    console.error(`\n✗ Unexpected error:\n${err.message}\n`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);

  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        const err = error as Error;
        console.error(`\nWarning: Failed to clean up temp directory ${tempDir}: ${err.message}`);
      }
    }
  }
}

main().catch((error) => {
  const err = error as Error;
  console.error(`\nFatal error: ${err.message}\n`);
  process.exit(1);
});
