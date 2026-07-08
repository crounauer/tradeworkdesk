/**
 * Figma ZIP + URL → Template Package Converter
 * 
 * Converts Figma-exported React template + published URL into TWD template format
 */

import JSZip from "jszip";
import type { FigmaContent } from "./figma-content-mapping";

// Type: App.tsx extracted data
type FigmaAppData = FigmaContent;

export type ConversionResult = {
  success: boolean;
  templateSlug: string;
  templateName: string;
  templateDescription: string;
  pages: string[];
  blocksPerPage: Record<string, number>;
  blockTypes: string[];
  designTokens: Record<string, any>;
  content?: FigmaContent;
  blockProps?: Record<string, Record<string, unknown>>;
  pageBlockProps?: Record<string, Record<string, Record<string, unknown>>>;
  packageUrl?: string;
  error?: string;
  errorDetails?: any;
};

/**
 * Parse an array of JS object literals into typed records.
 * Strips JSX values (e.g. `icon: <Droplets size={28} />`) then extracts the
 * requested string/number fields from each top-level `{ ... }` object.
 */
function parseObjectArray(
  raw: string,
  stringFields: string[],
  numberFields: string[] = [],
): Array<Record<string, string | number>> {
  // Remove JSX-valued fields so brace matching is safe (JSX contains `{28}`).
  const cleaned = raw.replace(/\b\w+\s*:\s*<[^>]*\/?>\s*,?/g, "");
  const objects = cleaned.match(/\{[^{}]*\}/g) || [];
  const results: Array<Record<string, string | number>> = [];

  for (const obj of objects) {
    const record: Record<string, string | number> = {};
    for (const field of stringFields) {
      const m = obj.match(new RegExp(`\\b${field}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (m) record[field] = m[1].replace(/\\"/g, '"');
    }
    for (const field of numberFields) {
      const m = obj.match(new RegExp(`\\b${field}\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
      if (m) record[field] = Number(m[1]);
    }
    if (Object.keys(record).length > 0) results.push(record);
  }

  return results;
}

/** Parse an array of bare string literals, e.g. `["Reading", "Caversham"]`. */
function parseStringArray(raw: string): string[] {
  const matches = raw.match(/"((?:[^"\\]|\\.)*)"/g) || [];
  return matches.map((s) => s.slice(1, -1).replace(/\\"/g, '"'));
}

function pageComponentToSlug(componentName: string): string | null {
  const map: Record<string, string> = {
    HomePage: "home",
    ServicesPage: "services",
    ServiceDetailPage: "service-detail",
    EmergencyPage: "emergency",
    AreasPage: "areas",
    ReviewsPage: "reviews",
    GalleryPage: "gallery",
    BlogIndexPage: "blog-index",
    BlogPostPage: "blog-post",
    BookingPage: "booking",
    ContactPage: "contact",
    LegalPage: "legal",
    NotFoundPage: "404",
  };
  return map[componentName] || null;
}

/**
 * Extract App.tsx constants and data structures.
 */
export async function extractFigmaAppData(zip: JSZip): Promise<FigmaAppData> {
  const appTsxFile = zip.file("src/app/App.tsx");
  if (!appTsxFile) {
    throw new Error("App.tsx not found in ZIP - expected at src/app/App.tsx");
  }

  const src = await appTsxFile.async("text");

  const strConst = (pattern: RegExp): string | null => {
    const m = src.match(pattern);
    return m ? m[1] : null;
  };

  const arrayBody = (name: string): string => {
    const m = src.match(new RegExp(`const ${name}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\];`));
    return m ? m[1] : "";
  };

  const company = strConst(/const COMPANY = "([^"]+)"/) || "Local Plumbing Pro";
  const phone = strConst(/const PHONE = "([^"]+)"/) || "01234 567 890";
  const tagline = strConst(/const TAGLINE = "([^"]+)"/) || "Reliable local trade services";

  const services = parseObjectArray(arrayBody("SERVICES_DATA"), ["title", "desc", "slug"]).map((s) => ({
    title: String(s.title || ""),
    description: String(s.desc || ""),
    slug: String(s.slug || ""),
  }));

  const testimonials = parseObjectArray(
    arrayBody("TESTIMONIALS_DATA"),
    ["name", "location", "text", "date"],
    ["stars"],
  ).map((t) => ({
    name: String(t.name || ""),
    location: String(t.location || ""),
    text: String(t.text || ""),
    date: String(t.date || ""),
    stars: Number(t.stars || 5),
  }));

  const areas = parseStringArray(arrayBody("AREAS_DATA"));

  const faq = parseObjectArray(arrayBody("FAQ_DATA"), ["q", "a"]).map((f) => ({
    q: String(f.q || ""),
    a: String(f.a || ""),
  }));

  const processSteps = parseObjectArray(arrayBody("PROCESS_STEPS"), ["step", "title", "desc"]).map((p) => ({
    step: String(p.step || ""),
    title: String(p.title || ""),
    desc: String(p.desc || ""),
  }));

  const blogPosts = parseObjectArray(arrayBody("BLOG_POSTS"), ["slug", "title", "excerpt", "date", "category"]).map(
    (b) => ({
      slug: String(b.slug || ""),
      title: String(b.title || ""),
      excerpt: String(b.excerpt || ""),
      date: String(b.date || ""),
      category: String(b.category || ""),
    }),
  );

  const galleryImages = parseObjectArray(arrayBody("GALLERY_IMAGES"), ["url", "alt"]).map((g) => ({
    url: String(g.url || ""),
    alt: String(g.alt || ""),
  }));

  // "Why choose us" reasons are declared inline inside a block component.
  const whyChoose = parseObjectArray(arrayBody("reasons"), ["title", "desc"]).map((r) => ({
    title: String(r.title || ""),
    desc: String(r.desc || ""),
  }));

  // Trust badges are inline `{ icon: <...>, text: "..." }` entries; dedupe by text.
  const badgeMatches = src.match(/icon:\s*<[^>]*\/?>\s*,\s*text:\s*"([^"]+)"/g) || [];
  const badges = Array.from(
    new Set(
      badgeMatches
        .map((m) => (m.match(/text:\s*"([^"]+)"/) || [])[1])
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const location =
    strConst(/const LOCATION = "([^"]+)"/) ||
    (areas.length > 0 ? `${areas[0]} & surrounding areas` : "your local area");

  // Per-page hero extraction: parse each `*Page` component and its first HeroBlock.
  const pageHeroes: Record<string, { title?: string; subtitle?: string; bgImage?: string; emergencyMode?: boolean; showTrust?: boolean }> = {};
  const pageFunctionRegex = /function\s+([A-Za-z]+Page)\s*\(/g;
  const pageFns: Array<{ name: string; index: number }> = [];
  let fnMatch: RegExpExecArray | null;
  while ((fnMatch = pageFunctionRegex.exec(src)) !== null) {
    pageFns.push({ name: fnMatch[1], index: fnMatch.index });
  }

  for (let i = 0; i < pageFns.length; i++) {
    const current = pageFns[i];
    const nextIndex = i + 1 < pageFns.length ? pageFns[i + 1].index : src.length;
    const pageSlug = pageComponentToSlug(current.name);
    if (!pageSlug) continue;

    const section = src.slice(current.index, nextIndex);
    const heroBlockMatch = section.match(/<HeroBlock([\s\S]*?)\/>/);
    if (!heroBlockMatch) continue;

    const heroAttrs = heroBlockMatch[1] || "";
    const title = (heroAttrs.match(/\btitle\s*=\s*"([^"]+)"/) || [])[1];
    const subtitle = (heroAttrs.match(/\bsubtitle\s*=\s*"([^"]+)"/) || [])[1];
    const bgImage = (heroAttrs.match(/\bbgImage\s*=\s*"([^"]+)"/) || [])[1];
    const emergencyMode = /\bemergencyMode\b/.test(heroAttrs);
    const showTrust = /\bshowTrust\b/.test(heroAttrs);

    if (title || subtitle || bgImage || emergencyMode || showTrust) {
      pageHeroes[pageSlug] = {
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(bgImage ? { bgImage } : {}),
        ...(emergencyMode ? { emergencyMode: true } : {}),
        ...(showTrust ? { showTrust: true } : {}),
      };
    }
  }

  return {
    company,
    phone,
    tagline,
    location,
    navLinks: parseObjectArray(arrayBody("NAV_LINKS"), ["label", "page"]).map((n) => ({
      label: String(n.label || ""),
      page: String(n.page || ""),
    })),
    services,
    testimonials,
    areas,
    faq,
    processSteps,
    blogPosts,
    galleryImages,
    whyChoose,
    badges,
    pageHeroes,
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

  // Build a map of CSS variable definitions from :root first, then fill gaps from whole file.
  // This avoids `.dark` overrides replacing the intended default palette.
  const varMap: Record<string, string> = {};
  const rootBlockMatch = themeCss.match(/:root\s*\{([\s\S]*?)\}/);
  const rootCss = rootBlockMatch ? rootBlockMatch[1] : "";
  const rootVarRegex = /--([\w-]+)\s*:\s*([^;}\n]+)/g;
  let m;
  while ((m = rootVarRegex.exec(rootCss)) !== null) {
    varMap[m[1].trim()] = m[2].trim();
  }
  const allVarRegex = /--([\w-]+)\s*:\s*([^;}\n]+)/g;
  while ((m = allVarRegex.exec(themeCss)) !== null) {
    const key = m[1].trim();
    if (!(key in varMap)) varMap[key] = m[2].trim();
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
    /^hsla?\s*\(/.test(v) ||
    /^oklch\s*\(/.test(v);

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
      "services.rates",
      "process.steps",
      "amazon",
      "cta.banner",
      "site.footer",
    ],
    services: [
      "site.header",
      "hero.standard",
      "services.grid",
      "services.rates",
      "why.choose.us",
      "faq.accordion",
      "cta.banner",
      "site.footer",
    ],
    "service-detail": [
      "site.header",
      "hero.standard",
      "features.list",
      "services.rates",
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
      "hero.standard",
      "legal.content",
      "faq.accordion",
      "site.footer",
    ],
    "404": [
      "site.header",
      "hero.standard",
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

    // Build real block props from extracted content, keyed by block type.
    const { buildBlockPropsMap, buildPageBlockPropsMap } = await import("./figma-content-mapping");
    const blockProps = buildBlockPropsMap(appData, Array.from(allBlockTypes));
    const pageBlockProps = buildPageBlockPropsMap(appData, blockMapping);

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
      content: appData,
      blockProps,
      pageBlockProps,
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
