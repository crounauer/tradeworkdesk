#!/usr/bin/env node

/**
 * Template Ingestion Script
 * Ingests Figma-exported templates and stores them in the database
 *
 * Usage: pnpm exec ts-node lib/ingest-templates.ts <template-dir-1> <template-dir-2> ...
 */

import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabaseUrl = process.env.SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

interface TemplateMetadata {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  industry_tags?: string[];
  features?: string[];
  figma_project_url?: string;
  exported_at?: string;
}

interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  sidebar?: Record<string, string>;
  chart?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Extract CSS variables from CSS content
 */
function extractCssVariables(css: string): Record<string, string> {
  const variables: Record<string, string> = {};

  // Match :root { ... } block
  const rootRegex = /:root\s*\{([^}]+)\}/s;
  const rootMatch = css.match(rootRegex);

  if (!rootMatch) return variables;

  const declarations = rootMatch[1];
  const varRegex = /--([a-z0-9-]+):\s*([^;]+);/gi;

  let match;
  while ((match = varRegex.exec(declarations)) !== null) {
    const varName = match[1].trim();
    const varValue = match[2].trim();
    variables[varName] = varValue;
  }

  return variables;
}

/**
 * Organize CSS variables into semantic groups
 */
function organizeDesignTokens(variables: Record<string, string>): DesignTokens {
  const tokens: DesignTokens = {
    colors: {},
    typography: {},
  };

  for (const [name, value] of Object.entries(variables)) {
    // Primary color groups
    if (
      name === "background" ||
      name === "foreground" ||
      name === "card" ||
      name === "card-foreground" ||
      name === "popover" ||
      name === "popover-foreground" ||
      name === "primary" ||
      name === "primary-foreground" ||
      name === "secondary" ||
      name === "secondary-foreground" ||
      name === "muted" ||
      name === "muted-foreground" ||
      name === "accent" ||
      name === "accent-foreground" ||
      name === "destructive" ||
      name === "destructive-foreground" ||
      name === "border" ||
      name === "input" ||
      name === "input-background" ||
      name === "switch-background" ||
      name === "ring"
    ) {
      tokens.colors[name] = value;
    }
    // Typography: font-size, font-weight, etc.
    else if (
      name.startsWith("font-") ||
      name === "radius" ||
      name === "font-weight-medium" ||
      name === "font-weight-normal"
    ) {
      tokens.typography[name] = value;
    }
    // Sidebar: sidebar-background, sidebar-primary, etc.
    else if (name.startsWith("sidebar-")) {
      if (!tokens.sidebar) tokens.sidebar = {};
      const sidebarName = name.replace("sidebar-", "");
      tokens.sidebar[sidebarName] = value;
    }
    // Chart colors: chart-1, chart-2, etc.
    else if (name.startsWith("chart-")) {
      if (!tokens.chart) tokens.chart = {};
      const chartName = name.replace("chart-", "");
      tokens.chart[chartName] = value;
    }
  }

  return tokens;
}

/**
 * Load template metadata from metadata.json
 */
async function loadMetadata(
  templateDir: string
): Promise<TemplateMetadata | null> {
  try {
    const metadataPath = path.join(templateDir, "metadata.json");
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    console.warn(`⚠ No metadata.json found in ${templateDir}`);
    return null;
  }
}

/**
 * Extract CSS from template
 */
async function loadCss(templateDir: string): Promise<string | null> {
  const cssFiles = [
    "default_shadcn_theme.css",
    "src/styles/theme.css",
    "src/styles/globals.css",
    "src/styles/index.css",
  ];

  for (const cssFile of cssFiles) {
    const cssPath = path.join(templateDir, cssFile);
    try {
      return await fs.readFile(cssPath, "utf-8");
    } catch {
      // Try next file
    }
  }

  return null;
}

/**
 * Ingest a single template
 */
async function ingestTemplate(
  templateDir: string,
  createdById: string = "00000000-0000-0000-0000-000000000000" // superadmin placeholder
): Promise<boolean> {
  console.log(`\n📦 Processing template: ${path.basename(templateDir)}`);

  // Load metadata
  const metadata = await loadMetadata(templateDir);
  if (!metadata) {
    console.error(
      `❌ Failed to load metadata for ${path.basename(templateDir)}`
    );
    return false;
  }

  console.log(`   Name: ${metadata.name}`);
  console.log(`   Slug: ${metadata.slug}`);

  // Load CSS
  const cssContent = await loadCss(templateDir);
  if (!cssContent) {
    console.error(
      `❌ Failed to load CSS for ${path.basename(templateDir)}`
    );
    return false;
  }

  // Extract design tokens
  const cssVariables = extractCssVariables(cssContent);
  const designTokens = organizeDesignTokens(cssVariables);

  console.log(
    `   Colors extracted: ${Object.keys(designTokens.colors).length}`
  );
  console.log(
    `   Typography vars: ${Object.keys(designTokens.typography).length}`
  );

  // Check if template already exists
  const { data: existing } = await supabase
    .from("website_templates")
    .select("id")
    .eq("slug", metadata.slug)
    .single();

  let templateId: string;
  let isNew = false;

  if (existing) {
    templateId = existing.id;
    console.log(`   ℹ Template already exists, updating...`);

    // Update existing template
    const { error } = await supabase
      .from("website_templates")
      .update({
        design_tokens: designTokens,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    if (error) {
      console.error(`   ❌ Failed to update template: ${error.message}`);
      return false;
    }
  } else {
    templateId = uuidv4();
    isNew = true;

    // Create new template
    const { error: insertError } = await supabase
      .from("website_templates")
      .insert({
        id: templateId,
        name: metadata.name,
        slug: metadata.slug,
        description: metadata.description,
        category: metadata.category || "general",
        version: 1,
        design_tokens: designTokens,
        figma_export_info: {
          exported_at: metadata.exported_at || new Date().toISOString(),
          figma_project_url: metadata.figma_project_url,
          features: metadata.features || [],
          industry_tags: metadata.industry_tags || [],
        },
        created_by: createdById,
        is_active: true, // Auto-activate ingested templates
        is_featured: false,
      });

    if (insertError) {
      console.error(
        `   ❌ Failed to insert template: ${insertError.message}`
      );
      return false;
    }

    console.log(`   ✓ Template created`);

    // Create initial version
    const { error: versionError } = await supabase
      .from("template_versions")
      .insert({
        id: uuidv4(),
        template_id: templateId,
        version: 1,
        design_tokens: designTokens,
        demo_pages: [],
        release_notes: "Initial version from Figma export",
      });

    if (versionError) {
      console.error(`   ⚠ Failed to create version record: ${versionError.message}`);
    }
  }

  return true;
}

/**
 * Main ingestion process
 */
async function main() {
  const templateDirs = process.argv.slice(2);

  if (templateDirs.length === 0) {
    console.error(
      "Usage: ts-node lib/ingest-templates.ts <template-dir-1> <template-dir-2> ..."
    );
    process.exit(1);
  }

  console.log("🚀 Starting template ingestion...");

  let successCount = 0;
  let failureCount = 0;

  for (const templateDir of templateDirs) {
    try {
      const success = await ingestTemplate(templateDir);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(
        `   ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      failureCount++;
    }
  }

  console.log("\n✅ Ingestion complete:");
  console.log(`   ${successCount} template(s) ingested`);
  if (failureCount > 0) {
    console.log(`   ${failureCount} template(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
