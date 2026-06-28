#!/usr/bin/env node

import { promises as fs } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { extractTemplateZip, validateZipFile, ZipExtractionError } from './safeZipExtract';
import { readTemplatePackage } from './readTemplatePackage';

/**
 * CLI script to validate a TWD template ZIP package without importing it.
 *
 * Usage: tsx src/templates/validateTemplateZipCli.ts path/to/template.zip
 */
async function main() {
  const zipPath = process.argv[2];

  if (!zipPath) {
    console.error('Usage: tsx src/templates/validateTemplateZipCli.ts <path/to/template.zip>');
    process.exit(1);
  }

  const safeZipPath = resolve(zipPath);
  let tempDir: string | null = null;

  try {
    // Step 1: Verify ZIP file exists
    console.log(`\nValidating ZIP file: ${safeZipPath}`);
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
    console.log('Validating ZIP structure...');
    try {
      await validateZipFile(safeZipPath);
    } catch (error) {
      const err = error as Error;
      console.error(`\n✗ ZIP validation failed:\n${err.message}\n`);
      process.exit(1);
    }

    // Step 3: Create temporary directory
    console.log('Creating temporary directory...');
    tempDir = await mkdtemp(join(tmpdir(), 'twd-template-'));

    // Step 4: Extract ZIP
    console.log(`Extracting to: ${tempDir}`);
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
    let pkg;
    try {
      pkg = await readTemplatePackage(tempDir);
    } catch (error) {
      const err = error as Error;
      console.error(`\n✗ Package validation failed:\n${err.message}\n`);
      process.exit(1);
    }

    // Step 6: Print validation summary
    console.log('\n✓ Validation successful!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Template Package Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Slug:               ${pkg.templateSlug}`);
    console.log(`  Name:               ${pkg.template.name}`);
    console.log(`  Version:            ${pkg.template.version || '(not specified)'}`);
    console.log(`  Category:           ${pkg.template.category || '(not specified)'}`);
    console.log(`  Pages:              ${pkg.stats.pageCount}`);
    console.log(`  Total blocks:       ${pkg.stats.blockCount}`);
    console.log(`  Block types:        ${pkg.stats.blockTypes.join(', ')}`);

    console.log('\n  Pages:');
    for (const page of pkg.pagesManifest.pages) {
      const blockCount = pkg.pages.get(page.slug)?.blocks.length || 0;
      console.log(
        `    • ${page.slug.padEnd(20)} (${blockCount} block${blockCount !== 1 ? 's' : ' '}) - ${page.title}`
      );
    }

    console.log(
      `\n  Block Registry:     ${pkg.blockRegistry.blocks.length} block type${pkg.blockRegistry.blocks.length !== 1 ? 's' : ''} registered`
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✓ Ready for import!\n');

    process.exit(0);

  } catch (error) {
    const err = error as Error;
    console.error(`\n✗ Unexpected error:\n${err.message}\n`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);

  } finally {
    // Step 7: Always clean up temporary directory
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        const err = error as Error;
        console.error(
          `\nWarning: Failed to clean up temp directory ${tempDir}: ${err.message}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(`\nFatal error: ${error.message}\n`);
  process.exit(1);
});
