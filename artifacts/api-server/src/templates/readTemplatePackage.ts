import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import {
  TemplateJsonSchema,
  TemplatePagesManifestSchema,
  TemplatePageFileSchema,
  TemplateThemeSchema,
  TemplateCmsMappingSchema,
  TemplateBlockRegistrySchema,
  TemplateContentModesSchema,
  TemplateContentSeedSchema,
  type TemplateJson,
  type TemplatePagesManifest,
  type TemplatePageFile,
  type TemplateTheme,
  type TemplateCmsMapping,
  type TemplateBlockRegistry,
  type TemplateContentMode,
  type TemplateContentModes,
  type TemplateContentSeed,
} from './templatePackageSchema';
import { ZodError } from 'zod';
import { findUnsupportedBlockTypes } from '../lib/template-import-safeguards';

/**
 * Result of successfully reading and validating a template package.
 */
export interface ReadTemplatePackageResult {
  templateSlug: string;
  template: TemplateJson;
  pagesManifest: TemplatePagesManifest;
  pages: Map<string, TemplatePageFile>;
  contentModes: TemplateContentModes | null;
  contentSeeds: Partial<Record<TemplateContentMode, TemplateContentSeed>>;
  theme: TemplateTheme;
  cmsMapping: TemplateCmsMapping;
  blockRegistry: TemplateBlockRegistry;
  stats: {
    pageCount: number;
    blockCount: number;
    blockTypes: string[];
  };
}

/**
 * Helper: Safely read and parse a JSON file.
 */
async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Helper: Read, parse, and validate a JSON file against a Zod schema.
 */
async function validateJsonFile<T>(filePath: string, schema: any): Promise<T> {
  try {
    const data = await readJsonFile(filePath);
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.errors
        .map(
          (e) =>
            `${e.path.join('.')} - ${e.code}: ${e.message}`
        )
        .join('; ');
      throw new Error(
        `Schema validation failed for ${filePath}:\n${issues}`
      );
    }
    throw error;
  }
}

/**
 * Helper: Find the single template folder under extractedRoot/templates/
 */
async function findTemplateFolder(extractedRoot: string): Promise<string> {
  const templatesDir = join(extractedRoot, 'templates');

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const templateFolders = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith('.')
    );

    if (templateFolders.length === 0) {
      throw new Error(
        `No template folders found in ${templatesDir}. Expected templates/[slug]/`
      );
    }

    if (templateFolders.length > 1) {
      throw new Error(
        `Multiple template folders found in ${templatesDir}: ${templateFolders.map((f) => f.name).join(', ')}. Only one template per ZIP supported.`
      );
    }

    return templatesDir;
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('No template')) {
      throw new Error(
        `Failed to read templates folder at ${templatesDir}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Read and validate a template package from an extracted folder.
 *
 * @param extractedRoot - Path to the extracted ZIP root directory
 * @returns Validated template package with all files and cross-validation complete
 * @throws Error if structure is invalid, files are missing, or validation fails
 */
export async function readTemplatePackage(
  extractedRoot: string
): Promise<ReadTemplatePackageResult> {
  const safeRoot = resolve(extractedRoot);

  // Step 1: Locate the template folder
  const templatesDir = await findTemplateFolder(safeRoot);
  const templateFolders = await fs.readdir(templatesDir, {
    withFileTypes: true,
  });
  const templateFolderName = templateFolders.find(
    (e) => e.isDirectory() && !e.name.startsWith('.')
  )!.name;
  const templateDir = join(templatesDir, templateFolderName);
  const templateSlug = templateFolderName;

  // Step 2: Read and validate template.json
  const templateJsonPath = join(templateDir, 'template.json');
  let template: TemplateJson;
  try {
    await fs.stat(templateJsonPath);
    template = await validateJsonFile(templateJsonPath, TemplateJsonSchema);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(
        `Required file not found: ${templateJsonPath}`
      );
    }
    throw error;
  }

  // Cross-check: Folder slug must match template.json slug
  if (templateSlug !== template.slug) {
    throw new Error(
      `Template folder name "${templateSlug}" does not match template.json slug "${template.slug}"`
    );
  }

  // Step 3: Read and validate pages.json
  const pagesJsonPath = join(templateDir, 'pages', 'pages.json');
  let pagesManifest: TemplatePagesManifest;
  try {
    await fs.stat(pagesJsonPath);
    pagesManifest = await validateJsonFile(pagesJsonPath, TemplatePagesManifestSchema);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(
        `Required file not found: ${pagesJsonPath}`
      );
    }
    throw error;
  }

  // Cross-check: pages.json template must match template.json slug
  if (pagesManifest.template !== template.slug) {
    throw new Error(
      `pages.json template "${pagesManifest.template}" does not match template.json slug "${template.slug}"`
    );
  }

  // Cross-check: Every page in template.json pages must exist in pages.json
  const manifestPageSlugs = new Set(pagesManifest.pages.map((p) => p.slug));
  for (const requiredPage of template.pages) {
    if (!manifestPageSlugs.has(requiredPage)) {
      throw new Error(
        `Page "${requiredPage}" listed in template.json is missing from pages.json`
      );
    }
  }

  // Step 4: Read and validate each page file
  const pages = new Map<string, TemplatePageFile>();
  const pageSlugs = new Set<string>();
  const pagePaths = new Set<string>();

  for (const pageEntry of pagesManifest.pages) {
    // Check for duplicate slugs
    if (pageSlugs.has(pageEntry.slug)) {
      throw new Error(
        `Duplicate page slug "${pageEntry.slug}" in pages.json`
      );
    }
    pageSlugs.add(pageEntry.slug);

    // Check for duplicate paths
    if (pagePaths.has(pageEntry.path)) {
      throw new Error(
        `Duplicate page path "${pageEntry.path}" in pages.json`
      );
    }
    pagePaths.add(pageEntry.path);

    // Read the page file
    const pageFilePath = join(templateDir, 'pages', pageEntry.file);
    let pageFile: TemplatePageFile;
    try {
      await fs.stat(pageFilePath);
      pageFile = await validateJsonFile(pageFilePath, TemplatePageFileSchema);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(
          `Required page file not found: ${pageFilePath} (referenced in pages.json)`
        );
      }
      throw error;
    }

    // Cross-check: Page file slug must match manifest slug
    if (pageFile.slug !== pageEntry.slug) {
      throw new Error(
        `Page file ${pageFilePath} has slug "${pageFile.slug}" but pages.json lists slug "${pageEntry.slug}"`
      );
    }

    // Cross-check: Page file path must match manifest path
    if (pageFile.path !== pageEntry.path) {
      throw new Error(
        `Page file ${pageFilePath} has path "${pageFile.path}" but pages.json lists path "${pageEntry.path}"`
      );
    }

    // Check for duplicate block IDs within this page
    const blockIds = new Set<string>();
    for (const block of pageFile.blocks) {
      if (blockIds.has(block.id)) {
        throw new Error(
          `Duplicate block ID "${block.id}" in page file ${pageFilePath}`
        );
      }
      blockIds.add(block.id);
    }

    pages.set(pageEntry.slug, pageFile);
  }

  // Cross-check: Every page in pages.json must have been read successfully
  if (pages.size !== pagesManifest.pages.length) {
    throw new Error(
      `Internal error: page count mismatch (expected ${pagesManifest.pages.length}, got ${pages.size})`
    );
  }

  // Step 5: Read and validate theme.json (optional)
  const themeJsonPath = join(templateDir, 'styles', 'theme.json');
  let theme: TemplateTheme;
  try {
    await fs.stat(themeJsonPath);
    theme = await validateJsonFile(themeJsonPath, TemplateThemeSchema);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      // Theme is optional, use empty object
      theme = {};
    } else {
      throw error;
    }
  }

  // Step 6: Read and validate cms-mapping.json (optional)
  const cmsMappingPath = join(templateDir, 'cms-mapping.json');
  let cmsMapping: TemplateCmsMapping;
  try {
    await fs.stat(cmsMappingPath);
    cmsMapping = await validateJsonFile(cmsMappingPath, TemplateCmsMappingSchema);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      // CMS mapping is optional, use empty object
      cmsMapping = {};
    } else {
      throw error;
    }
  }

  // Step 6b: Read and validate optional content mode seeds.
  const contentModesPath = join(templateDir, 'content', 'content-modes.json');
  let contentModes: TemplateContentModes | null = null;
  const contentSeeds: Partial<Record<TemplateContentMode, TemplateContentSeed>> = {};
  let hasContentModesManifest = false;

  try {
    await fs.stat(contentModesPath);
    hasContentModesManifest = true;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      throw error;
    }
  }

  if (!hasContentModesManifest) {
    // No optional content modes manifest present.
  } else {
    contentModes = await validateJsonFile(contentModesPath, TemplateContentModesSchema);

    if (contentModes.template !== template.slug) {
      throw new Error(
        `content-modes.json template "${contentModes.template}" does not match template.json slug "${template.slug}"`
      );
    }

    const modeNames = new Set<string>();
    for (const modeDef of contentModes.modes) {
      if (modeNames.has(modeDef.mode)) {
        throw new Error(`Duplicate content mode "${modeDef.mode}" in ${contentModesPath}`);
      }
      modeNames.add(modeDef.mode);

      const seedPath = join(templateDir, 'content', modeDef.file);
      const seed = await validateJsonFile<TemplateContentSeed>(seedPath, TemplateContentSeedSchema);

      if (seed.template !== template.slug) {
        throw new Error(
          `Content seed file ${seedPath} has template "${seed.template}" but expected "${template.slug}"`
        );
      }

      if (seed.mode !== modeDef.mode) {
        throw new Error(
          `Content seed file ${seedPath} has mode "${seed.mode}" but content-modes.json declares "${modeDef.mode}"`
        );
      }

      for (const [pageSlug, pageSeed] of Object.entries(seed.pages)) {
        if (!pages.has(pageSlug)) {
          throw new Error(
            `Content seed file ${seedPath} contains unknown page slug "${pageSlug}"`
          );
        }

        for (const block of pageSeed.blocks) {
          if (!block.type) {
            throw new Error(`Content seed file ${seedPath} has a block with missing type in page "${pageSlug}"`);
          }
        }
      }

      contentSeeds[modeDef.mode] = seed;
    }

    if (!modeNames.has(contentModes.defaultMode)) {
      throw new Error(
        `Default content mode "${contentModes.defaultMode}" is not listed in content-modes.json modes[]`
      );
    }
  }

  // Step 7: Read and validate block-registry.json
  const registryPath = join(safeRoot, 'registry', 'block-registry.json');
  let blockRegistry: TemplateBlockRegistry;
  try {
    await fs.stat(registryPath);
    blockRegistry = await validateJsonFile(registryPath, TemplateBlockRegistrySchema);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(
        `Required file not found: ${registryPath}`
      );
    }
    throw error;
  }

  // Cross-check: Registry must not be empty
  if (!blockRegistry.blocks || blockRegistry.blocks.length === 0) {
    throw new Error(
      `Block registry in ${registryPath} is empty. At least one block type must be defined.`
    );
  }

  // Cross-check: All block types used in pages must be in the registry
  const registryBlockTypes = new Set(
    blockRegistry.blocks.map((b) => b.type)
  );
  const usedBlockTypes = new Set<string>();

  for (const pageFile of pages.values()) {
    for (const block of pageFile.blocks) {
      usedBlockTypes.add(block.type);
      if (!registryBlockTypes.has(block.type)) {
        throw new Error(
          `Block type "${block.type}" used in page "${pageFile.slug}" is not defined in block registry at ${registryPath}`
        );
      }
    }
  }

  // Step 8: Calculate statistics
  let totalBlockCount = 0;
  for (const pageFile of pages.values()) {
    totalBlockCount += pageFile.blocks.length;
  }

  const unsupportedBlockTypes = findUnsupportedBlockTypes(
    Array.from(pages.values()).map((pageFile) => ({
      blocks: pageFile.blocks.map((block) => ({ block_type: block.type })),
    })),
  );

  if (unsupportedBlockTypes.length > 0) {
    throw new Error(
      `Unsupported block type(s) for tenant renderer: ${unsupportedBlockTypes.join(', ')}`
    );
  }

  const stats = {
    pageCount: pages.size,
    blockCount: totalBlockCount,
    blockTypes: Array.from(usedBlockTypes).sort(),
  };

  // Step 9: Return the complete validated package
  return {
    templateSlug,
    template,
    pagesManifest,
    pages,
    contentModes,
    contentSeeds,
    theme,
    cmsMapping,
    blockRegistry,
    stats,
  };
}
