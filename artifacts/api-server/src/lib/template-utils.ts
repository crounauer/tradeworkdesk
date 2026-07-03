/**
 * Template utility functions for seeding default pages and theme
 */

export interface DesignTokens {
  colors?: Record<string, string>;
  typography?: Record<string, string>;
  sidebar?: Record<string, string>;
  chart?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

export interface TemplatePalette {
  accent_color: string;
  primary_color: string;
  primary_text_color: string;
  background_color: string;
  muted_background: string;
  border_color: string;
  text_color: string;
  muted_text_color: string;
  nav_background: string;
  nav_text: string;
  footer_background: string;
  footer_text: string;
}

export const TEMPLATE_PALETTES: Record<string, TemplatePalette> = {
  "modern-trade": {
    accent_color: "#F59E0B",
    primary_color: "#0F172A",
    primary_text_color: "#FFFFFF",
    background_color: "#F8FAFC",
    muted_background: "#EEF2F7",
    border_color: "#CBD5E1",
    text_color: "#0F172A",
    muted_text_color: "#475569",
    nav_background: "#FFFFFF",
    nav_text: "#0F172A",
    footer_background: "#0B1220",
    footer_text: "#94A3B8",
  },
  "classic-trade": {
    accent_color: "#C78A2C",
    primary_color: "#1E2A3A",
    primary_text_color: "#F8F5EE",
    background_color: "#F7F3EC",
    muted_background: "#EFE7DA",
    border_color: "#D8CBB4",
    text_color: "#2A241B",
    muted_text_color: "#6E6250",
    nav_background: "#1E2A3A",
    nav_text: "#F8F5EE",
    footer_background: "#151E2A",
    footer_text: "#C9BFAF",
  },
  "professional-trade": {
    accent_color: "#2563EB",
    primary_color: "#0B3A6E",
    primary_text_color: "#FFFFFF",
    background_color: "#F8FBFF",
    muted_background: "#EAF2FC",
    border_color: "#C8D9EE",
    text_color: "#0F2942",
    muted_text_color: "#4A6A88",
    nav_background: "#0B3A6E",
    nav_text: "#FFFFFF",
    footer_background: "#082B52",
    footer_text: "#B9CCE3",
  },
  "eco-renewables-trade": {
    accent_color: "#65A30D",
    primary_color: "#1F4D2E",
    primary_text_color: "#FFFFFF",
    background_color: "#F5FAF4",
    muted_background: "#E6F2E5",
    border_color: "#BFD9C2",
    text_color: "#1F3A27",
    muted_text_color: "#557462",
    nav_background: "#1F4D2E",
    nav_text: "#FFFFFF",
    footer_background: "#173A23",
    footer_text: "#A8C2AE",
  },
  "bold-industrial-trade": {
    accent_color: "#F97316",
    primary_color: "#111827",
    primary_text_color: "#FFFFFF",
    background_color: "#FFF7ED",
    muted_background: "#FFECD6",
    border_color: "#F5CBA7",
    text_color: "#1F2937",
    muted_text_color: "#7C5A3B",
    nav_background: "#111827",
    nav_text: "#FFFFFF",
    footer_background: "#0B1220",
    footer_text: "#C9D2E0",
  },
  "clean-minimal-trade": {
    accent_color: "#0EA5A4",
    primary_color: "#0F172A",
    primary_text_color: "#FFFFFF",
    background_color: "#FAFAF9",
    muted_background: "#F1F5F9",
    border_color: "#DDE5EC",
    text_color: "#1E293B",
    muted_text_color: "#64748B",
    nav_background: "#FFFFFF",
    nav_text: "#0F172A",
    footer_background: "#111827",
    footer_text: "#CBD5E1",
  },
};

const DEFAULT_TEMPLATE_PALETTE: TemplatePalette = {
  accent_color: "#0d9488",
  primary_color: "#1c2942",
  primary_text_color: "#ffffff",
  background_color: "#ffffff",
  muted_background: "#f8fafc",
  border_color: "#e2e8f0",
  text_color: "#111827",
  muted_text_color: "#475569",
  nav_background: "#1c2942",
  nav_text: "#ffffff",
  footer_background: "#111827",
  footer_text: "#9ca3af",
};

function normalizeTemplateSlug(templateSlug: string | null | undefined): string {
  return String(templateSlug || "").trim().toLowerCase();
}

export function getPaletteForTemplate(templateSlug: string | null | undefined): TemplatePalette {
  return TEMPLATE_PALETTES[normalizeTemplateSlug(templateSlug)] || DEFAULT_TEMPLATE_PALETTE;
}

export function mergeThemeWithPaletteDefaults(
  theme: Record<string, unknown> | null | undefined,
  templateSlug: string | null | undefined,
): Record<string, unknown> {
  const palette = getPaletteForTemplate(templateSlug);
  const current = (theme && typeof theme === "object") ? theme : {};
  return {
    ...palette,
    ...current,
  };
}

export function buildTemplateDefaultTheme(templateSlug: string | null | undefined, designTokens?: Record<string, unknown>): Record<string, unknown> {
  const palette = getPaletteForTemplate(templateSlug);
  return {
    designTokens: designTokens || {},
    ...palette,
  };
}

/**
 * Generate a default theme from design tokens.
 * Includes branded colors, nav/footer colors, and the full design system.
 */
export function generateDefaultTheme(designTokens: Record<string, unknown>): Record<string, unknown> {
  const tokens = (designTokens || {}) as Record<string, unknown>;
  const colors = ((tokens.colors as Record<string, unknown> | undefined) || {});

  const inferred = {
    accent_color: String(colors.primary || colors.secondary || DEFAULT_TEMPLATE_PALETTE.accent_color),
    primary_color: String(colors.primary || DEFAULT_TEMPLATE_PALETTE.primary_color),
    primary_text_color: String(colors.foreground || DEFAULT_TEMPLATE_PALETTE.primary_text_color),
    background_color: String(colors.background || DEFAULT_TEMPLATE_PALETTE.background_color),
    muted_background: String(colors.muted || DEFAULT_TEMPLATE_PALETTE.muted_background),
    border_color: String(colors.border || DEFAULT_TEMPLATE_PALETTE.border_color),
    text_color: String(colors.text || colors.foreground || DEFAULT_TEMPLATE_PALETTE.text_color),
    muted_text_color: String(colors.mutedForeground || DEFAULT_TEMPLATE_PALETTE.muted_text_color),
    nav_background: String(colors.navBackground || colors.background || DEFAULT_TEMPLATE_PALETTE.nav_background),
    nav_text: String(colors.navText || colors.foreground || DEFAULT_TEMPLATE_PALETTE.nav_text),
    footer_background: String(colors.footerBackground || colors.muted || DEFAULT_TEMPLATE_PALETTE.footer_background),
    footer_text: String(colors.footerText || colors.mutedForeground || DEFAULT_TEMPLATE_PALETTE.footer_text),
  };

  return {
    designTokens: designTokens,
    ...inferred,
  };
}

/**
 * Get default pages structure for a template.
 * Can be template-specific (based on slug) or generic.
 */
export function getDefaultPagesForTemplate(templateSlug: string): Array<Record<string, unknown>> {
  // For now, all templates use the same page structure
  // In future, this can be template-specific (e.g., "modern" template has different blocks)

  return [
    {
      slug: "home",
      title: "Home",
      page_type: "home",
      show_in_nav: true,
      nav_label: null,
      nav_order: 1,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "features_bar", sort_order: 1 },
        { type: "services", sort_order: 2 },
        { type: "process", sort_order: 3 },
        { type: "testimonials", sort_order: 4 },
        { type: "trust_badges", sort_order: 5 },
        { type: "cta", sort_order: 6 },
      ],
    },
    {
      slug: "services",
      title: "Services",
      page_type: "custom",
      show_in_nav: true,
      nav_label: null,
      nav_order: 2,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "services", sort_order: 1 },
        { type: "cta", sort_order: 2 },
      ],
    },
    {
      slug: "how-it-works",
      title: "How It Works",
      page_type: "custom",
      show_in_nav: true,
      nav_label: null,
      nav_order: 3,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "process", sort_order: 1 },
        { type: "cta", sort_order: 2 },
      ],
    },
    {
      slug: "projects",
      title: "Projects",
      page_type: "custom",
      show_in_nav: true,
      nav_label: null,
      nav_order: 4,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "projects", sort_order: 1 },
        { type: "cta", sort_order: 2 },
      ],
    },
    {
      slug: "reviews",
      title: "Reviews",
      page_type: "custom",
      show_in_nav: true,
      nav_label: null,
      nav_order: 5,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "testimonials", sort_order: 1 },
        { type: "cta", sort_order: 2 },
      ],
    },
    {
      slug: "areas",
      title: "Areas We Cover",
      page_type: "custom",
      show_in_nav: true,
      nav_label: null,
      nav_order: 6,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "areas", sort_order: 1 },
        { type: "cta", sort_order: 2 },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      page_type: "custom",
      show_in_nav: true,
      nav_label: null,
      nav_order: 7,
      blocks: [
        { type: "hero", sort_order: 0 },
        { type: "contact", sort_order: 1 },
      ],
    },
  ];
}
