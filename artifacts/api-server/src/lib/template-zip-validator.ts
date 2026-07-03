import type * as JSZipTypes from "jszip";
import { z } from "zod";
import {
  performEnhancedValidation,
  formatEnhancedValidationErrors,
  hasEnhancedValidationErrors,
} from "./template-validation-enhanced";

type TemplatePageForValidation = {
  title?: string;
  blocks: Array<{ type?: string; block_type?: string; id?: string }> | unknown[];
};

export type TemplateValidationReport = {
  valid: boolean;
  templateSlug: string | null;
  templateName: string | null;
  pagesFound: string[];
  blocksFound: number;
  warnings: string[];
  errors: string[];
  unsupportedBlockTypes?: string[];
  mappedBlockTypes?: string[];
};

type ZipObject = JSZipTypes.JSZipObject;
type ZipEntry = { path: string; file: ZipObject };

const MAX_FILE_COUNT = 300;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

const canonicalPageFiles = [
  "home.json",
  "about.json",
  "services.json",
  "service-detail.json",
  "areas-covered.json",
  "area-detail.json",
  "reviews.json",
  "gallery.json",
  "faq.json",
  "contact.json",
  "blog-index.json",
  "blog-post.json",
  "privacy-policy.json",
  "cookie-policy.json",
  "terms-conditions.json",
  "404.json",
] as const;

const legacyPageAliases: Record<string, string> = {
  "areas.json": "areas-covered.json",
  "blog.json": "blog-index.json",
  "privacy.json": "privacy-policy.json",
  "terms.json": "terms-conditions.json",
};

const canonicalPageAliases = Object.fromEntries(
  Object.entries(legacyPageAliases).map(([legacyName, canonicalName]) => [canonicalName, legacyName]),
);

const templateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
}).passthrough();

const pagesManifestEntrySchema = z.union([
  z.string().min(1),
  z.object({
    file: z.string().min(1).optional(),
    filename: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
  }).passthrough(),
]);

const pagesManifestSchema = z.union([
  z.array(pagesManifestEntrySchema).min(1),
  z.object({ pages: z.array(pagesManifestEntrySchema).min(1) }).passthrough(),
]);

const pageSchema = z.object({
  title: z.string().optional(),
  blocks: z.array(z.object({ type: z.string().optional(), block_type: z.string().optional() }).passthrough()).default([]),
}).passthrough();

const themeSchema = z.record(z.unknown());
const cmsMappingSchema = z.record(z.unknown());

const blockRegistrySchema = z.union([
  z.object({
    blocks: z.array(z.object({ type: z.string().optional(), label: z.string().optional(), key: z.string().optional(), name: z.string().optional() }).passthrough()).min(1),
  }).passthrough(),
  z.array(z.object({ type: z.string().optional(), label: z.string().optional(), key: z.string().optional(), name: z.string().optional() }).passthrough()).min(1),
]);

const blockTypeAliases: Record<string, string> = {
  trust_bar:'trust_badges', benefits_grid:'feature_cards', accreditation_logos:'accreditations', process_steps:'process', reviews_carousel:'reviews', cta_banner:'cta_band', blog_cards:'blog_index', footer_cta:'cta_band',
  hero_centered:'hero', service_detail_intro:'service_detail', team_cards:'feature_cards', area_list:'areas_grid', map_opening_hours:'contact', gallery_grid:'gallery', before_after:'gallery', faq_accordion:'faq', contact_form_section:'contact_form', richtext_article_body:'rich_text', system_404:'text', pricing_table:'feature_cards'
};

const supportedBlockTypes = new Set(['hero','hero_split','text','rich_text','text_section','image','cta','cta_band','services','services_grid','service_detail','contact_form','contact','testimonials','reviews','gallery','accreditations','trust_badges','spacer','why_choose_us','faq','areas','areas_grid','area_detail_hero','brands','partners','features_bar','feature_cards','process','steps','how_it_works','project_showcase','case_study','projects','online_booking','booking','sticky_mobile_cta','blog_index','blog_post','legal_content']);

function normalizePath(rawPath: string): string | null {
  const cleaned = rawPath.replace(/\\/g, "/").trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("/") || cleaned.startsWith("//") || /^[a-zA-Z]:\//.test(cleaned)) return null;

  const parts = cleaned.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") return null;
    normalized.push(part);
  }

  return normalized.join("/");
}

function isDisallowedFile(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (/(^|\/)(node_modules|dist|build|out|\.git)(\/|$)/.test(lower)) return true;
  // Allow project manifests inside source-figma-prototype reference folders.
  const inPrototypeSource = /(^|\/)source-figma-prototype\//.test(lower);
  if (/(^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/i.test(lower) && !inPrototypeSource) return true;
  if (/(^|\/)(dockerfile|docker-compose\.ya?ml|\.env(\.|$)|\.npmrc)$/i.test(lower)) return true;
  if (/(^|\/).*(\.exe|\.dll|\.so|\.dylib|\.bat|\.cmd|\.ps1|\.sh)$/i.test(lower)) return true;
  return false;
}

function getSize(file: ZipObject): number {
  const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
  return typeof data?.uncompressedSize === "number" ? data.uncompressedSize : 0;
}

async function readText(file: ZipObject): Promise<string> {
  return await file.async("text");
}

function pageCandidates(name: string): string[] {
  const base = name.split("/").pop() || name;
  const candidates = new Set<string>([base]);
  if (legacyPageAliases[base]) {
    candidates.add(legacyPageAliases[base]);
  }
  if (canonicalPageAliases[base]) {
    candidates.add(canonicalPageAliases[base]);
  }
  return Array.from(candidates);
}

function categorizeBlockTypes(
  pages: TemplatePageForValidation[],
): { truly_unsupported: string[]; mapped_via_alias: string[] } {
  const mapped = new Set<string>();
  const unsupported = new Set<string>();
  for (const page of pages) {
    if (!Array.isArray(page.blocks)) continue;
    for (const block of page.blocks) {
      const blockObj = block as { type?: string; block_type?: string };
      const raw = String(blockObj.block_type || blockObj.type || "").trim().toLowerCase();
      if (!raw) continue;
      if (blockTypeAliases[raw]) {
        mapped.add(raw);
      } else if (!supportedBlockTypes.has(raw)) {
        unsupported.add(raw);
      }
    }
  }

  return {
    truly_unsupported: Array.from(unsupported),
    mapped_via_alias: Array.from(mapped)
  };
}

function parsePagesManifest(raw: unknown): { pages: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const parsed = pagesManifestSchema.parse(raw);
  const entries = Array.isArray(parsed) ? parsed : parsed.pages;

  const pages = entries.map((entry) => {
    if (typeof entry === "string") {
      const base = entry.split("/").pop() || entry;
      const alias = legacyPageAliases[base];
      if (alias) {
        warnings.push(`Legacy page filename '${base}' normalized to '${alias}'.`);
        return alias;
      }
      return base;
    }

    const rawFile = entry.file || entry.filename || entry.path || `${entry.slug || ""}.json`;
    const base = rawFile.split("/").pop() || rawFile;
    const alias = legacyPageAliases[base];
    if (alias) {
      warnings.push(`Legacy page filename '${base}' normalized to '${alias}'.`);
      return alias;
    }
    return base;
  });

  return { pages, warnings };
}

function parseRegistry(raw: unknown): { blocks: Array<{ type: string; label: string }>; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const parsed = blockRegistrySchema.safeParse(raw);
  if (!parsed.success) {
    return { blocks: [], warnings, errors: ["registry/block-registry.json is invalid."] };
  }

  const items = Array.isArray(parsed.data) ? parsed.data : parsed.data.blocks;
  if (Array.isArray(parsed.data)) {
    warnings.push("Legacy block registry array normalized to blocks[].type/label.");
  }

  const blocks = items
    .map((item) => {
      const type = String(item.type || item.key || item.name || "").trim();
      const label = String(item.label || item.name || item.key || item.type || "").trim();
      if (!item.type && (item.key || item.name)) {
        warnings.push(`Legacy block registry entry normalized to type '${type}'.`);
      }
      return { type, label };
    })
    .filter((block) => block.type.length > 0);

  if (blocks.length === 0) {
    errors.push("registry/block-registry.json does not contain any usable block definitions.");
  }

  return { blocks, warnings, errors };
}

function extractEntries(zip: { files: Record<string, ZipObject> }): { entries: ZipEntry[]; warnings: string[]; errors: string[] } {
  const entries: ZipEntry[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let totalSize = 0;

  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;

    const normalized = normalizePath(file.name);
    if (!normalized) {
      errors.push(`Rejected unsafe path: ${file.name}`);
      continue;
    }

    if (isDisallowedFile(normalized)) {
      errors.push(`Rejected unsupported file: ${normalized}`);
      continue;
    }

    totalSize += getSize(file);
    if (totalSize > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      errors.push(`Archive exceeds maximum extracted size of ${MAX_TOTAL_UNCOMPRESSED_BYTES} bytes.`);
      break;
    }

    entries.push({ path: normalized, file });
  }

  if (entries.length > MAX_FILE_COUNT) {
    errors.push(`Archive contains ${entries.length} files, exceeding the maximum of ${MAX_FILE_COUNT}.`);
  }

  const topLevel = new Set(entries.map((entry) => entry.path.split("/")[0]).filter(Boolean));
  if (topLevel.size === 1) {
    const wrapper = Array.from(topLevel)[0];
    const stripped = entries.map((entry) => ({
      ...entry,
      path: entry.path.startsWith(`${wrapper}/`) ? entry.path.slice(wrapper.length + 1) : entry.path,
    }));
    const roots = new Set(stripped.map((entry) => entry.path.split("/")[0]).filter(Boolean));
    if (roots.has("README.md") || roots.has("registry") || roots.has("templates")) {
      warnings.push(`Detected outer wrapper folder '${wrapper}' and normalized paths internally.`);
      entries.length = 0;
      entries.push(...stripped);
    }
  }

  return { entries, warnings, errors };
}

function getTemplateFolder(entries: ZipEntry[]): string | null {
  const templateEntry = entries.find((entry) => entry.path.endsWith("/template.json"));
  if (!templateEntry) return null;
  return templateEntry.path.slice(0, -"/template.json".length);
}

export async function validateTemplateZip(input: Buffer | ArrayBuffer | Uint8Array): Promise<TemplateValidationReport> {
  const report: TemplateValidationReport = {
    valid: false,
    templateSlug: null,
    templateName: null,
    pagesFound: [],
    blocksFound: 0,
    warnings: [],
    errors: [],
  };

  const JSZipModule: any = await import("jszip");
  const JSZip = JSZipModule.default as { loadAsync: (data: Buffer | ArrayBuffer | Uint8Array) => Promise<{ files: Record<string, ZipObject> }> };
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(input);
  } catch (error) {
    report.errors.push(`Unable to read ZIP archive: ${(error as Error).message}`);
    return report;
  }

  const extracted = extractEntries(zip);
  report.warnings.push(...extracted.warnings);
  report.errors.push(...extracted.errors);
  if (report.errors.length > 0) return report;

  const entries = extracted.entries;
  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const templateFolder = getTemplateFolder(entries);
  if (!templateFolder) {
    report.errors.push("Missing required file: templates/[template-slug]/template.json");
    return report;
  }

  const templateJsonPath = `${templateFolder}/template.json`;
  const pagesManifestPath = `${templateFolder}/pages/pages.json`;
  const themePath = `${templateFolder}/styles/theme.json`;
  const cmsMappingPath = `${templateFolder}/styles/cms-mapping.json`;
  const legacyCmsPath = `${templateFolder}/cms-mapping.json`;

  for (const rootFile of ["README.md", "scripts/validate-template.ts", "supabase/seed-template-example.sql", "registry/block-registry.json"]) {
    if (!entryByPath.has(rootFile)) {
      report.errors.push(`Missing required file: ${rootFile}`);
    }
  }

  // source-figma-prototype is optional for package-based templates.

  const templateEntry = entryByPath.get(templateJsonPath);
  if (!templateEntry) {
    report.errors.push(`Missing required file: ${templateJsonPath}`);
  } else {
    try {
      const parsedTemplate = templateSchema.parse(JSON.parse(await readText(templateEntry.file)));
      report.templateSlug = parsedTemplate.slug;
      report.templateName = parsedTemplate.name;
    } catch (error) {
      report.errors.push(`Invalid JSON in ${templateJsonPath}: ${(error as Error).message}`);
    }
  }

  const pagesEntry = entryByPath.get(pagesManifestPath);
  if (!pagesEntry) {
    report.errors.push(`Missing required file: ${pagesManifestPath}`);
  } else {
    try {
      const parsedPages = parsePagesManifest(JSON.parse(await readText(pagesEntry.file)));
      report.pagesFound = parsedPages.pages;
      report.warnings.push(...parsedPages.warnings);
    } catch (error) {
      report.errors.push(`Invalid JSON in ${pagesManifestPath}: ${(error as Error).message}`);
    }
  }

  const collectedPages: TemplatePageForValidation[] = [];
  for (const pageName of report.pagesFound) {
    const candidates = pageCandidates(pageName).map((candidate) => `${templateFolder}/pages/${candidate}`);
    const pagePath = candidates.find((candidate) => entryByPath.has(candidate)) || candidates[0];
    const pageEntry = entryByPath.get(pagePath);
    if (!pageEntry) {
      report.errors.push(`Missing page JSON: ${pagePath}`);
      continue;
    }

    try {
      const parsedPage = pageSchema.parse(JSON.parse(await readText(pageEntry.file)));
      report.blocksFound += parsedPage.blocks.length;
      collectedPages.push(parsedPage);
      if (!parsedPage.title) {
        report.warnings.push(`Page JSON '${pagePath}' is missing a title field.`);
      }
    } catch (error) {
      report.errors.push(`Invalid JSON in ${pagePath}: ${(error as Error).message}`);
    }
  }

  for (const canonicalPage of canonicalPageFiles) {
    const candidates = pageCandidates(canonicalPage).map((candidate) => `${templateFolder}/pages/${candidate}`);
    if (!candidates.some((candidate) => entryByPath.has(candidate))) {
      report.errors.push(`Missing page JSON: ${templateFolder}/pages/${canonicalPage}`);
    }
  }

  if (!entryByPath.has(themePath)) {
    report.errors.push(`Missing required file: ${themePath}`);
  } else {
    try {
      themeSchema.parse(JSON.parse(await readText(entryByPath.get(themePath)!.file)));
    } catch (error) {
      report.errors.push(`Invalid JSON in ${themePath}: ${(error as Error).message}`);
    }
  }

  let cmsEntry = entryByPath.get(cmsMappingPath);
  if (!cmsEntry && entryByPath.has(legacyCmsPath)) {
    cmsEntry = entryByPath.get(legacyCmsPath);
  }

  if (!cmsEntry) {
    report.errors.push(`Missing required file: ${cmsMappingPath}`);
  } else {
    try {
      cmsMappingSchema.parse(JSON.parse(await readText(cmsEntry.file)));
    } catch (error) {
      report.errors.push(`Invalid JSON in ${cmsMappingPath}: ${(error as Error).message}`);
    }
  }

  // Parse registry and collect block types
  let registryBlockTypes = new Set<string>();
  const registryEntry = entryByPath.get("registry/block-registry.json");
  if (registryEntry) {
    try {
      const registry = parseRegistry(JSON.parse(await readText(registryEntry.file)));
      report.warnings.push(...registry.warnings);
      report.errors.push(...registry.errors);
      report.blocksFound += registry.blocks.length;
      registryBlockTypes = new Set(registry.blocks.map((b) => b.type.toLowerCase()));
    } catch (error) {
      report.errors.push(`Invalid JSON in registry/block-registry.json: ${(error as Error).message}`);
    }
  }

  // Run enhanced validation checks if template slug and pages are available
  if (report.templateSlug && report.pagesFound.length > 0 && collectedPages.length > 0) {
    // Build page structure for enhanced validation
    const enhancedPages = collectedPages.map((page, index) => ({
      slug: report.pagesFound[index] || `page-${index}`,
      path: `${templateFolder}/pages/${report.pagesFound[index] || `page-${index}`}`,
      title: page.title || `Page ${index + 1}`,
      blocks: Array.isArray(page.blocks)
        ? page.blocks.map((b: any) => ({
            id: b.id,
            type: b.type || b.block_type,
            block_type: b.block_type || b.type,
          }))
        : [],
    }));

    // Collect all page files found in ZIP
    const zipPageFiles = new Set<string>();
    for (const entry of entries) {
      if (entry.path.startsWith(`${templateFolder}/pages/`) && entry.path.endsWith(".json")) {
        const fileName = entry.path.split("/").pop();
        if (fileName) zipPageFiles.add(fileName);
      }
    }

    const listedPageFiles = new Set(report.pagesFound);

    // Perform enhanced validation
    const enhancedErrors = performEnhancedValidation({
      pages: enhancedPages,
      registryBlockTypes,
      folderSlug: templateFolder.split("/")[1] || "",
      fileSlug: report.templateSlug,
      listedPageFiles,
      zipPageFiles,
    });

    // Add critical errors from enhanced validation (exclude orphaned files)
    if (hasEnhancedValidationErrors(enhancedErrors)) {
      const errorMessages = formatEnhancedValidationErrors(enhancedErrors);
      // Filter out orphaned files message - those are warnings, not errors
      const criticalErrors = errorMessages.filter((msg) => !msg.includes("Orphaned page files"));
      report.errors.push(...criticalErrors);
    }
    
    // Ignore orphaned page files warnings to keep validation output actionable.
  }

  report.valid = report.errors.length === 0;
  // Categorize block types for UI feedback
  if (collectedPages.length > 0) {
    const { truly_unsupported, mapped_via_alias } = categorizeBlockTypes(collectedPages);
    if (truly_unsupported.length > 0) {
      report.unsupportedBlockTypes = truly_unsupported;
    }
    if (mapped_via_alias.length > 0) {
      report.mappedBlockTypes = mapped_via_alias;
    }
  }

  return report;
}

export { canonicalPageFiles, legacyPageAliases, MAX_FILE_COUNT, MAX_TOTAL_UNCOMPRESSED_BYTES };