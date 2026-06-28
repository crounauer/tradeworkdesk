/**
 * Enhanced template validation checks
 * Validates:
 * - Duplicate page slugs
 * - Duplicate page paths
 * - Duplicate block IDs within pages
 * - Block types not in registry
 * - Template slug mismatch
 * - Empty pages
 * - Empty block registry
 * - Orphaned page files (not listed in pages.json)
 */

export type EnhancedValidationErrors = {
  duplicatePageSlugs: string[];
  duplicatePagePaths: string[];
  duplicateBlockIds: Array<{ page: string; blockIds: string[] }>;
  unregisteredBlockTypes: string[];
  slugMismatch: { folder: string; file: string } | null;
  emptyPages: string[];
  emptyBlockRegistry: boolean;
  orphanedPageFiles: string[];
};

type PageBlock = {
  id?: string;
  type?: string;
  block_type?: string;
  [key: string]: unknown;
};

type TemplatePage = {
  slug: string;
  path: string;
  title?: string;
  blocks: PageBlock[];
};

/**
 * Check for duplicate page slugs
 */
export function checkDuplicatePageSlugs(pages: TemplatePage[]): string[] {
  const slugs = new Map<string, number>();
  for (const page of pages) {
    slugs.set(page.slug, (slugs.get(page.slug) ?? 0) + 1);
  }
  return Array.from(slugs.entries())
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug);
}

/**
 * Check for duplicate page paths
 */
export function checkDuplicatePagePaths(pages: TemplatePage[]): string[] {
  const paths = new Map<string, number>();
  for (const page of pages) {
    paths.set(page.path, (paths.get(page.path) ?? 0) + 1);
  }
  return Array.from(paths.entries())
    .filter(([, count]) => count > 1)
    .map(([path]) => path);
}

/**
 * Check for duplicate block IDs within each page
 */
export function checkDuplicateBlockIds(pages: TemplatePage[]): Array<{ page: string; blockIds: string[] }> {
  const duplicates: Array<{ page: string; blockIds: string[] }> = [];

  for (const page of pages) {
    const blockIds = new Map<string, number>();
    for (const block of page.blocks) {
      if (!block.id) continue;
      const id = String(block.id);
      blockIds.set(id, (blockIds.get(id) ?? 0) + 1);
    }

    const duplicateIds = Array.from(blockIds.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id);

    if (duplicateIds.length > 0) {
      duplicates.push({ page: page.slug, blockIds: duplicateIds });
    }
  }

  return duplicates;
}

/**
 * Check for block types not in registry
 */
export function checkUnregisteredBlockTypes(
  pages: TemplatePage[],
  registryBlockTypes: Set<string>,
): string[] {
  const unregistered = new Set<string>();

  for (const page of pages) {
    for (const block of page.blocks) {
      const blockType = String(block.type || block.block_type || "").trim().toLowerCase();
      if (!blockType) continue;
      if (!registryBlockTypes.has(blockType)) {
        unregistered.add(blockType);
      }
    }
  }

  return Array.from(unregistered).sort();
}

/**
 * Check for template slug mismatch between folder and template.json
 */
export function checkSlugMismatch(folderSlug: string, fileSlug: string): { folder: string; file: string } | null {
  if (folderSlug.toLowerCase() !== fileSlug.toLowerCase()) {
    return { folder: folderSlug, file: fileSlug };
  }
  return null;
}

/**
 * Check for empty pages (pages with no blocks)
 */
export function checkEmptyPages(pages: TemplatePage[]): string[] {
  return pages.filter((page) => page.blocks.length === 0).map((page) => page.slug);
}

/**
 * Check if block registry is empty
 */
export function checkEmptyBlockRegistry(registryBlockTypes: Set<string>): boolean {
  return registryBlockTypes.size === 0;
}

/**
 * Check for orphaned page files not listed in pages.json
 * Returns array of file paths found in ZIP but not in pages.json
 */
export function checkOrphanedPageFiles(
  listedPageFiles: Set<string>,
  zipPageFiles: Set<string>,
): string[] {
  return Array.from(zipPageFiles).filter((file) => !listedPageFiles.has(file)).sort();
}

/**
 * Run all enhanced validation checks
 */
export function performEnhancedValidation(opts: {
  pages: TemplatePage[];
  registryBlockTypes: Set<string>;
  folderSlug: string;
  fileSlug: string;
  listedPageFiles: Set<string>;
  zipPageFiles: Set<string>;
}): EnhancedValidationErrors {
  return {
    duplicatePageSlugs: checkDuplicatePageSlugs(opts.pages),
    duplicatePagePaths: checkDuplicatePagePaths(opts.pages),
    duplicateBlockIds: checkDuplicateBlockIds(opts.pages),
    unregisteredBlockTypes: checkUnregisteredBlockTypes(opts.pages, opts.registryBlockTypes),
    slugMismatch: checkSlugMismatch(opts.folderSlug, opts.fileSlug),
    emptyPages: checkEmptyPages(opts.pages),
    emptyBlockRegistry: checkEmptyBlockRegistry(opts.registryBlockTypes),
    orphanedPageFiles: checkOrphanedPageFiles(opts.listedPageFiles, opts.zipPageFiles),
  };
}

/**
 * Convert enhanced validation errors to human-readable error messages
 */
export function formatEnhancedValidationErrors(errors: EnhancedValidationErrors): string[] {
  const messages: string[] = [];

  if (errors.duplicatePageSlugs.length > 0) {
    messages.push(`Duplicate page slugs found: ${errors.duplicatePageSlugs.join(", ")}`);
  }

  if (errors.duplicatePagePaths.length > 0) {
    messages.push(`Duplicate page paths found: ${errors.duplicatePagePaths.join(", ")}`);
  }

  if (errors.duplicateBlockIds.length > 0) {
    for (const { page, blockIds } of errors.duplicateBlockIds) {
      messages.push(`Page '${page}' has duplicate block IDs: ${blockIds.join(", ")}`);
    }
  }

  if (errors.unregisteredBlockTypes.length > 0) {
    messages.push(`Block types not in registry: ${errors.unregisteredBlockTypes.join(", ")}`);
  }

  if (errors.slugMismatch) {
    messages.push(
      `Template slug mismatch: folder contains '${errors.slugMismatch.folder}' but template.json specifies '${errors.slugMismatch.file}'`,
    );
  }

  if (errors.emptyPages.length > 0) {
    messages.push(`Empty pages (no blocks) found: ${errors.emptyPages.join(", ")}`);
  }

  if (errors.emptyBlockRegistry) {
    messages.push("Block registry is empty or contains no valid block definitions");
  }

  if (errors.orphanedPageFiles.length > 0) {
    messages.push(
      `Orphaned page files (in ZIP but not in pages.json): ${errors.orphanedPageFiles.join(", ")}`,
    );
  }

  return messages;
}

/**
 * Check if any enhanced validation errors are present (excluding warnings like orphaned files)
 */
export function hasEnhancedValidationErrors(errors: EnhancedValidationErrors): boolean {
  return (
    errors.duplicatePageSlugs.length > 0 ||
    errors.duplicatePagePaths.length > 0 ||
    errors.duplicateBlockIds.length > 0 ||
    errors.unregisteredBlockTypes.length > 0 ||
    errors.slugMismatch !== null ||
    errors.emptyPages.length > 0 ||
    errors.emptyBlockRegistry
  );
}
