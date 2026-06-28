/**
 * Safe ZIP Extraction Utility
 *
 * Safely extracts TWD template package ZIP files with security checks:
 * - Path traversal protection
 * - File/directory count limits
 * - Uncompressed size limits
 * - Proper stream cleanup
 *
 * Does NOT validate template structure or JSON content.
 */

import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve, join, relative, isAbsolute } from 'path';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';

// Configuration
const MAX_FILES = 500;
const MAX_UNCOMPRESSED_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Custom error class for extraction failures
 */
class ZipExtractionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'ZipExtractionError';
  }
}

/**
 * Validates that a path is safe to extract.
 * Rejects:
 * - Absolute paths
 * - Paths containing ".."
 * - Paths that resolve outside destinationDir
 *
 * @throws ZipExtractionError if path is unsafe
 */
function validateEntryPath(entryPath: string, destinationDir: string): string {
  // Reject absolute paths
  if (isAbsolute(entryPath)) {
    throw new ZipExtractionError(
      `Rejected absolute path in ZIP: ${entryPath}`,
      'ABSOLUTE_PATH_IN_ZIP'
    );
  }

  // Reject paths with ".."
  if (entryPath.includes('..')) {
    throw new ZipExtractionError(
      `Rejected path traversal attempt in ZIP: ${entryPath}`,
      'PATH_TRAVERSAL_IN_ZIP'
    );
  }

  // Resolve the target path and verify it stays inside destinationDir
  const targetPath = resolve(join(destinationDir, entryPath));
  const normalizedDest = resolve(destinationDir);

  if (!targetPath.startsWith(normalizedDest + '/') && targetPath !== normalizedDest) {
    throw new ZipExtractionError(
      `Path escapes destination directory: ${entryPath} → ${targetPath}`,
      'PATH_ESCAPE_ATTEMPT'
    );
  }

  return targetPath;
}

/**
 * Ensures that the parent directory of a file exists.
 *
 * @throws If directory creation fails
 */
async function ensureParentDir(filePath: string): Promise<void> {
  const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (parentDir && parentDir !== filePath) {
    await fs.mkdir(parentDir, { recursive: true });
  }
}

/**
 * Safely extracts a ZIP file to a destination directory.
 *
 * Security checks:
 * - Rejects absolute paths
 * - Rejects path traversal attempts (..)
 * - Verifies all paths stay inside destinationDir
 * - Limits file count (max 500)
 * - Limits total uncompressed size (max 50MB)
 * - Creates destinationDir if it doesn't exist
 * - Properly closes all streams
 *
 * @param zipFilePath - Path to the ZIP file to extract
 * @param destinationDir - Directory to extract into
 * @throws ZipExtractionError if extraction fails or security check fails
 * @throws Error if file system operations fail
 */
export async function extractTemplateZip(
  zipFilePath: string,
  destinationDir: string
): Promise<void> {
  let fileCount = 0;
  let totalUncompressedSize = 0;
  let extractedPaths: string[] = [];

  try {
    // Create destination directory
    await fs.mkdir(destinationDir, { recursive: true });

    // Create and pipe the ZIP extraction stream
    const readStream = createReadStream(zipFilePath);
    const parseStream = unzipper.Parse({ forceStream: true });

    // Process entries as they come out of the parser
    const pipelinePromise = pipeline(readStream, parseStream, async (source) => {
      for await (const entry of source) {
        const entryPath = entry.path;
        const entryType = entry.type; // 'Directory' or 'File'

        // Security check: validate the path
        let targetPath: string;
        try {
          targetPath = validateEntryPath(entryPath, destinationDir);
        } catch (error) {
          // Reject this entry and drain it
          await entry.autodrain();
          throw error;
        }

        // Handle directories
        if (entryType === 'Directory') {
          await fs.mkdir(targetPath, { recursive: true });
          extractedPaths.push(targetPath);
          continue;
        }

        // Handle files
        if (entryType === 'File') {
          // File count check
          fileCount++;
          if (fileCount > MAX_FILES) {
            await entry.autodrain();
            throw new ZipExtractionError(
              `ZIP contains more than ${MAX_FILES} files (file count: ${fileCount})`,
              'TOO_MANY_FILES'
            );
          }

          // Uncompressed size check
          const uncompressedSize = entry.vars.uncompressedSize || 0;
          totalUncompressedSize += uncompressedSize;
          if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE_BYTES) {
            await entry.autodrain();
            throw new ZipExtractionError(
              `Total uncompressed size exceeds ${MAX_UNCOMPRESSED_SIZE_BYTES / 1024 / 1024}MB (current: ${(totalUncompressedSize / 1024 / 1024).toFixed(2)}MB)`,
              'FILE_SIZE_EXCEEDED'
            );
          }

          // Ensure parent directory exists
          await ensureParentDir(targetPath);

          // Extract file using pipeline for safe stream handling
          const writeStream = createWriteStream(targetPath);
          await pipeline(entry, writeStream);
          extractedPaths.push(targetPath);
          continue;
        }

        // Unknown entry type - drain and skip
        await entry.autodrain();
      }
    });

    // Wait for pipeline to complete
    await pipelinePromise;
  } catch (error) {
    // Clean up extracted files on error
    try {
      for (const path of extractedPaths) {
        try {
          const stats = await fs.stat(path);
          if (stats.isDirectory()) {
            await fs.rm(path, { recursive: true, force: true });
          } else {
            await fs.unlink(path);
          }
        } catch {
          // Ignore cleanup errors, focus on reporting the original error
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    // Re-throw the original error
    if (error instanceof ZipExtractionError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ZipExtractionError(
        `Failed to extract ZIP: ${error.message}`,
        'EXTRACTION_FAILED'
      );
    }

    throw new ZipExtractionError('Failed to extract ZIP: Unknown error', 'EXTRACTION_FAILED');
  }
}

/**
 * Helper to validate ZIP file integrity before extraction
 * (Optional, can be used by importer)
 *
 * @throws Error if file does not exist or is not readable
 */
export async function validateZipFile(zipFilePath: string): Promise<void> {
  try {
    const stats = await fs.stat(zipFilePath);
    if (!stats.isFile()) {
      throw new Error(`ZIP file path is not a file: ${zipFilePath}`);
    }
    if (stats.size === 0) {
      throw new Error(`ZIP file is empty: ${zipFilePath}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid ZIP file: ${error.message}`);
    }
    throw error;
  }
}
