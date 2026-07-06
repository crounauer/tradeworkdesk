/**
 * Figma ZIP + URL → Template Package Converter
 * 
 * Converts Figma-exported React template + published URL into TWD template format
 */

import JSZip from "jszip";

// Type: App.tsx extracted data
type FigmaAppData = {
  company: string;
  phone: string;
  location: string;
  services: Array<{ title: string; desc: string; slug: string; icon: string }>;
  testimonials: Array<{ name: string; location: string; text: string; date: string; stars: number }>;
  areas: string[];
  faq: Array<{ q: string; a: string }>;
  processSteps: Array<{ step: string; title: string; desc: string }>;
  blogPosts: Array<{ slug: string; title: string; excerpt: string; date: string; category: string }>;
  galleryImages: Array<{ url: string; alt: string }>;
};

export type ConversionResult = {
  success: boolean;
  templateSlug: string;
  templateName: string;
  templateDescription: string;
  pages: string[];
  blocksPerPage: Record<string, number>;
  blockTypes: string[];
  designTokens: Record<string, any>;
  packageUrl?: string;
  error?: string;
  errorDetails?: any;
};

/**
 * Extract App.tsx constants and data structures using regex
 */
export async function extractFigmaAppData(zip: JSZip): Promise<FigmaAppData> {
  const appTsxFile = zip.file("src/app/App.tsx");
  if (!appTsxFile) {
    throw new Error("App.tsx not found in ZIP - expected at src/app/App.tsx");
  }

  const appTsxContent = await appTsxFile.async("text");

  // Helper to extract value between specific patterns
  const extractValue = (pattern: RegExp): string | null => {
    const match = appTsxContent.match(pattern);
    return match ? match[1] : null;
  };

  // Extract simple string constants
  const company = extractValue(/const COMPANY = "([^"]+)"/) || "Local Plumbing Pro";
  const phone = extractValue(/const PHONE = "([^"]+)"/) || "01234 567 890";
  const location = extractValue(/const LOCATION = "([^"]+)"/) || "Reading & Surrounding Areas";

  // Extract data arrays - capture JSON-like structure
  const extractArray = (pattern: RegExp): any[] => {
    const match = appTsxContent.match(pattern);
    if (!match) return [];
    try {
      // Try to parse the captured group as JSON
      const jsonStr = match[1]
        .replace(/'/g, '"')
        .replace(/undefined/g, "null")
        .replace(/\w+\(/g, '"') // Handle function calls
        .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove comments

      // More lenient parsing - just extract what we can
      return JSON.parse(`[${match[1]}]`);
    } catch {
      return [];
    }
  };

  return {
    company,
    phone,
    location,
    services: extractArray(/const SERVICES_DATA = \[([\s\S]*?)\];/) || [],
    testimonials: extractArray(/const TESTIMONIALS_DATA = \[([\s\S]*?)\];/) || [],
    areas: extractArray(/const AREAS_DATA = \[([\s\S]*?)\];/) || [],
    faq: extractArray(/const FAQ_DATA = \[([\s\S]*?)\];/) || [],
    processSteps: extractArray(/const PROCESS_STEPS = \[([\s\S]*?)\];/) || [],
    blogPosts: extractArray(/const BLOG_POSTS = \[([\s\S]*?)\];/) || [],
    galleryImages: extractArray(/const GALLERY_IMAGES = \[([\s\S]*?)\];/) || [],
  };
}

/**
 * Extract CSS variables and design tokens from theme CSS
 */
export async function extractDesignTokens(zip: JSZip): Promise<Record<string, any>> {
  const themeCssFile = zip.file("src/styles/theme.css");
  if (!themeCssFile) {
    return {
      colors: {
        primary: "#1e3a8a",
        accent: "#f97316",
        background: "#ffffff",
        text: "#111827",
      },
      typography: {
        bodyFamily: "system-ui, -apple-system, sans-serif",
        headingFamily: "system-ui, -apple-system, sans-serif",
      },
    };
  }

  const themeCss = await themeCssFile.async("text");
  const tokens: Record<string, any> = {
    colors: {},
    typography: {},
    spacing: {},
  };

  // Build a map of all CSS variable definitions: --varname → value
  const varMap: Record<string, string> = {};
  const allVarRegex = /--([\w-]+)\s*:\s*([^;}\n]+)/g;
  let m;
  while ((m = allVarRegex.exec(themeCss)) !== null) {
    varMap[m[1].trim()] = m[2].trim();
  }

  console.log(`[extractDesignTokens] Found ${Object.keys(varMap).length} CSS variables`, Object.keys(varMap).slice(0, 10));

  // Resolve a CSS value — follow var() references up to 3 levels deep
  const resolve = (val: string): string => {
    let v = val.trim();
    for (let i = 0; i < 3; i++) {
      const ref = v.match(/^var\(--([\w-]+)(?:,\s*([^)]+))?\)/);
      if (!ref) break;
      v = varMap[ref[1]] ?? ref[2] ?? v;
      v = v.trim();
    }
    return v;
  };

  // Extract only hex/rgb/hsl colour values
  const isColourValue = (v: string) =>
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    /^rgba?\s*\(/.test(v) ||
    /^hsla?\s*\(/.test(v);

  // Extract all color-like variables (aggressive)
  let extractedCount = 0;
  for (const [key, rawValue] of Object.entries(varMap)) {
    // Skip if clearly not a color
    if (key.includes("shadow") || key.includes("size") || key.includes("duration") || key.includes("delay")) continue;
    
    const resolved = resolve(rawValue);
    if (!isColourValue(resolved)) continue;
    
    extractedCount++;
    const cleanKey = key
      .replace(/^(color|colour|bg|text)-/, "")
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    tokens.colors[cleanKey] = resolved;
  }

  console.log(`[extractDesignTokens] Extracted ${extractedCount} colors:`, tokens.colors);

  // Ensure standard keys exist using fallbacks
  const fallbacks: Record<string, string[]> = {
    primary: ["primary", "colorPrimary", "brandPrimary", "blue", "mainColor", "brandColor"],
    accent: ["accent", "colorAccent", "brandAccent", "secondary", "orange", "highlightColor", "accentColor"],
    background: ["background", "bg", "colorBackground", "surface", "white", "pageBackground", "bgColor", "bodyBackground"],
    text: ["text", "colorText", "foreground", "textPrimary", "gray", "textColor", "contentColor"],
  };
  for (const [stdKey, candidates] of Object.entries(fallbacks)) {
    if (!tokens.colors[stdKey]) {
      const found = candidates.find((c) => tokens.colors[c]);
      if (found) tokens.colors[stdKey] = tokens.colors[found];
    }
  }

  // Extract typography - font-family and font-size from CSS
  const fontFamilyMatch = themeCss.match(/--(?:font|typography)-(?:family|body)\s*:\s*([^;}\n]+)/i);
  const headingFamilyMatch = themeCss.match(/--(?:font|typography)-(?:heading|display)\s*:\s*([^;}\n]+)/i);
  
  tokens.typography = {
    bodyFamily: fontFamilyMatch ? resolve(fontFamilyMatch[1]) : "system-ui, -apple-system, sans-serif",
    headingFamily: headingFamilyMatch ? resolve(headingFamilyMatch[1]) : "system-ui, -apple-system, sans-serif",
  };

  // Ensure we have at least standard color keys
  if (Object.keys(tokens.colors).length === 0) {
    tokens.colors = {
      primary: "#1e3a8a",
      accent: "#f97316",
      background: "#ffffff",
      text: "#111827",
    };
  }

  return tokens;
}

/**
 * Generate block mapping from Figma structure
 * Maps detected pages to appropriate block types
 */
export function generateBlockMapping(appData: FigmaAppData): Record<string, string[]> {
  const pages: Record<string, string[]> = {
    home: [
      "site.header",
      "hero.standard",
      "trust.badges",
      "features.list",
      "spacer",
      "testimonials",
      "services.grid",
      "process.steps",
      "cta.banner",
      "site.footer",
    ],
    services: [
      "site.header",
      "hero.standard",
      "services.grid",
      "why.choose.us",
      "faq.accordion",
      "cta.banner",
      "site.footer",
    ],
    "service-detail": [
      "site.header",
      "hero.standard",
      "features.list",
      "process.steps",
      "cta.banner",
      "site.footer",
    ],
    emergency: [
      "site.header",
      "hero.standard",
      "process.steps",
      "cta.banner",
      "site.footer",
    ],
    areas: [
      "site.header",
      "hero.standard",
      "areas.grid",
      "contact.split",
      "site.footer",
    ],
    reviews: [
      "site.header",
      "hero.standard",
      "reviews.grid",
      "testimonials",
      "brands",
      "cta.banner",
      "site.footer",
    ],
    gallery: [
      "site.header",
      "hero.standard",
      "gallery.grid",
      "project.showcase",
      "spacer",
      "site.footer",
    ],
    "blog-index": [
      "site.header",
      "hero.standard",
      "blog.index",
      "cta.banner",
      "site.footer",
    ],
    "blog-post": [
      "site.header",
      "hero.standard",
      "legal.content",
      "cta.banner",
      "site.footer",
    ],
    booking: [
      "site.header",
      "hero.standard",
      "online.booking",
      "cta.banner",
      "sticky.mobile.cta",
      "site.footer",
    ],
    contact: [
      "site.header",
      "hero.standard",
      "contact.split",
      "accreditations",
      "site.footer",
    ],
    legal: [
      "site.header",
      "legal.content",
      "faq.accordion",
      "site.footer",
    ],
    "404": [
      "site.header",
      "system.notFound",
      "cta.banner",
      "site.footer",
    ],
  };

  return pages;
}

/**
 * Main conversion function - analyze Figma ZIP
 */
export async function convertFigmaZipToTemplate(
  zipBuffer: Buffer,
  figmaUrl: string,
  templateName: string,
  industries: string[] = []
): Promise<ConversionResult> {
  try {
    // Extract ZIP
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extract data from App.tsx
    const appData = await extractFigmaAppData(zip);

    // Extract design tokens
    const designTokens = await extractDesignTokens(zip);

    // Generate block mapping
    const blockMapping = generateBlockMapping(appData);

    // Get all block types and pages
    const allBlockTypes = new Set<string>();
    Object.values(blockMapping).forEach((blocks) =>
      blocks.forEach((b) => allBlockTypes.add(b))
    );

    const pages = Object.keys(blockMapping);
    const blocksPerPage: Record<string, number> = {};
    pages.forEach((page) => {
      blocksPerPage[page] = blockMapping[page].length;
    });

    return {
      success: true,
      templateSlug: templateName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
      templateName,
      templateDescription: `Professional template based on ${appData.company} design. Includes ${Object.keys(blockMapping).length} pages with ${Array.from(allBlockTypes).length} block types.`,
      pages,
      blocksPerPage,
      blockTypes: Array.from(allBlockTypes).sort(),
      designTokens,
    };
  } catch (error) {
    console.error("[convertFigmaZipToTemplate]", error);
    return {
      success: false,
      templateSlug: "",
      templateName: "",
      templateDescription: "",
      pages: [],
      blocksPerPage: {},
      blockTypes: [],
      designTokens: {},
      error: error instanceof Error ? error.message : "Unknown error during conversion",
      errorDetails: error,
    };
  }
}

/**
 * Verify Figma URL is accessible
 */
export async function verifyFigmaUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status === 200;
  } catch (error) {
    console.error("[verifyFigmaUrl]", error);
    return false;
  }
}
