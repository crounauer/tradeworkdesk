/**
 * Figma Template Parser
 * Extracts design tokens and metadata from Figma-exported React template ZIPs
 *
 * Expects ZIP structure:
 * - metadata.json (template info)
 * - default_shadcn_theme.css (design tokens)
 * - index.html (optional preview)
 * - src/ (React source, for reference)
 */

import JSZip from "jszip";

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  sidebar?: Record<string, string>;
  chart?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

export interface TemplateMetadata {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  version?: string;
  figmaProjectUrl?: string;
}

export interface ParsedTemplate {
  metadata: TemplateMetadata;
  designTokens: DesignTokens;
  previewHtml?: string;
  extractedCss?: string;
  archiveFiles: string[];
}

/**
 * Extract CSS custom properties (--var-name) from CSS content
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
 * Determine whether a CSS variable name represents a typography/spacing token.
 */
function isTypographyVar(name: string): boolean {
  return (
    name.startsWith("font") ||
    name === "radius" ||
    name.startsWith("radius-") ||
    name.includes("leading") ||
    name.includes("tracking") ||
    name.includes("letter-spacing") ||
    name.includes("line-height")
  );
}

/**
 * Organize CSS variables into semantic groups.
 *
 * Supports both Figma "make" exports that prefix colors with `color-`
 * (e.g. --color-primary) and standard shadcn themes that use bare names
 * (e.g. --primary, --background, --foreground).
 */
function organizeDesignTokens(variables: Record<string, string>): DesignTokens {
  const tokens: DesignTokens = {
    colors: {},
    typography: {},
  };

  for (const [name, value] of Object.entries(variables)) {
    // Sidebar: sidebar-background, sidebar-primary, etc.
    if (name.startsWith("sidebar-")) {
      if (!tokens.sidebar) tokens.sidebar = {};
      tokens.sidebar[name.replace("sidebar-", "")] = value;
    }
    // Chart colors: chart-1, chart-2, etc.
    else if (name.startsWith("chart-")) {
      if (!tokens.chart) tokens.chart = {};
      tokens.chart[name.replace("chart-", "")] = value;
    }
    // Explicit color- prefix (Figma make exports)
    else if (name.startsWith("color-")) {
      tokens.colors[name.replace("color-", "")] = value;
    }
    // Typography / spacing tokens
    else if (isTypographyVar(name)) {
      tokens.typography[name] = value;
    }
    // Everything else is a shadcn color token (background, foreground,
    // primary, secondary, muted, accent, destructive, border, ...)
    else {
      tokens.colors[name] = value;
    }
  }

  return tokens;
}

/**
 * Parse Figma-exported ZIP file
 * Expects structure: TemplateName/metadata.json, TemplateName/default_shadcn_theme.css, etc.
 */
export async function parseFigmaTemplateZip(
  zipFile: Blob | ArrayBuffer | Buffer | Uint8Array
): Promise<ParsedTemplate> {
  const zip = new JSZip();
  await zip.loadAsync(zipFile);

  // Collect every file path in the archive so discovery does not depend on a
  // particular folder layout (Figma exports may or may not wrap files in a
  // top-level folder, and the theme CSS can live at the root or under src/).
  const allPaths: string[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir) allPaths.push(relativePath);
  });

  // Parse metadata.json wherever it lives (optional).
  let metadata: TemplateMetadata = {
    name: "Untitled Template",
    slug: "untitled-template",
  };

  const metadataPath = allPaths.find((p) =>
    p.toLowerCase().endsWith("metadata.json")
  );
  if (metadataPath) {
    const metadataFile = zip.file(metadataPath);
    if (metadataFile) {
      const metadataJson = await metadataFile.async("text");
      metadata = JSON.parse(metadataJson);
    }
  }

  // Extract CSS variables from the first theme file that yields tokens.
  let designTokens: DesignTokens = { colors: {}, typography: {} };
  let extractedCss = "";

  // Candidate theme files, in priority order (matched by file basename).
  const themeBasenames = [
    "default_shadcn_theme.css",
    "theme.css",
    "globals.css",
    "index.css",
  ];

  const matchesBasename = (path: string, base: string) => {
    const lower = path.toLowerCase();
    return lower === base || lower.endsWith("/" + base);
  };

  for (const base of themeBasenames) {
    const themePath = allPaths.find((p) => matchesBasename(p, base));
    if (!themePath) continue;
    const themeFile = zip.file(themePath);
    if (!themeFile) continue;
    const css = await themeFile.async("text");
    const cssVariables = extractCssVariables(css);
    // Skip empty/placeholder files (e.g. an empty globals.css).
    if (Object.keys(cssVariables).length === 0) continue;
    extractedCss = css;
    designTokens = organizeDesignTokens(cssVariables);
    break;
  }

  // Extract preview HTML (optional) — prefer a root index.html.
  let previewHtml: string | undefined;
  const indexPath =
    allPaths.find((p) => p.toLowerCase() === "index.html") ||
    allPaths.find((p) => p.toLowerCase().endsWith("/index.html"));
  if (indexPath) {
    const indexFile = zip.file(indexPath);
    if (indexFile) {
      previewHtml = await indexFile.async("text");
    }
  }

  return {
    metadata,
    designTokens,
    previewHtml,
    extractedCss,
    archiveFiles: allPaths,
  };
}

/**
 * Validate design tokens completeness
 */
export function validateDesignTokens(tokens: DesignTokens): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!tokens.colors || Object.keys(tokens.colors).length === 0) {
    warnings.push("No color variables found in CSS");
  }

  if (!tokens.typography || Object.keys(tokens.typography).length === 0) {
    warnings.push("No typography variables found in CSS");
  }

  // Check for essential colors
  const requiredColors = ["primary", "secondary", "background", "foreground"];
  for (const color of requiredColors) {
    if (!tokens.colors[color]) {
      warnings.push(`Missing essential color: ${color}`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Convert design tokens to CSS custom properties format (for applying to websites)
 */
export function tokensToCSS(tokens: DesignTokens): string {
  let css = ":root {\n";

  for (const [group, values] of Object.entries(tokens)) {
    if (!values || typeof values !== "object") continue;

    for (const [key, value] of Object.entries(values)) {
      const varName = group === "colors" 
        ? `--color-${key}` 
        : `--${group}-${key}`;
      css += `  ${varName}: ${value};\n`;
    }
  }

  css += "}\n";
  return css;
}
