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
    accent_color: "#FF6B35",
    primary_color: "#1F2937",
    primary_text_color: "#FFFFFF",
    background_color: "#FFF7F2",
    muted_background: "#FFE9DE",
    border_color: "#F2C8B5",
    text_color: "#1F2937",
    muted_text_color: "#6B7280",
    nav_background: "#FFFFFF",
    nav_text: "#1F2937",
    footer_background: "#111827",
    footer_text: "#D1D5DB",
  },
  "classic-trade": {
    accent_color: "#B7791F",
    primary_color: "#5A2E2E",
    primary_text_color: "#FFF8EE",
    background_color: "#FBF4E8",
    muted_background: "#F2E6D6",
    border_color: "#DFC7AA",
    text_color: "#3F2A20",
    muted_text_color: "#7B5E4A",
    nav_background: "#5A2E2E",
    nav_text: "#FFF8EE",
    footer_background: "#3D1F1F",
    footer_text: "#E9D7C0",
  },
  "professional-trade": {
    accent_color: "#0077B6",
    primary_color: "#0B2545",
    primary_text_color: "#FFFFFF",
    background_color: "#F4F8FC",
    muted_background: "#E6EEF7",
    border_color: "#C3D3E6",
    text_color: "#0B2545",
    muted_text_color: "#4F6B86",
    nav_background: "#0B2545",
    nav_text: "#FFFFFF",
    footer_background: "#081A2F",
    footer_text: "#BFD2E6",
  },
  "eco-renewables-trade": {
    accent_color: "#2E9B47",
    primary_color: "#1B4332",
    primary_text_color: "#FFFFFF",
    background_color: "#F3FBF4",
    muted_background: "#E1F1E5",
    border_color: "#B7D7BF",
    text_color: "#173A2C",
    muted_text_color: "#4D6F5E",
    nav_background: "#1B4332",
    nav_text: "#FFFFFF",
    footer_background: "#122E24",
    footer_text: "#B9D5C1",
  },
  "bold-industrial-trade": {
    accent_color: "#FF7A00",
    primary_color: "#2B2D42",
    primary_text_color: "#FFFFFF",
    background_color: "#F3F4F6",
    muted_background: "#E5E7EB",
    border_color: "#C7CDD6",
    text_color: "#1F2937",
    muted_text_color: "#4B5563",
    nav_background: "#2B2D42",
    nav_text: "#FFFFFF",
    footer_background: "#1F2233",
    footer_text: "#D1D5DB",
  },
  "clean-minimal-trade": {
    accent_color: "#7C3AED",
    primary_color: "#111827",
    primary_text_color: "#FFFFFF",
    background_color: "#FCFCFF",
    muted_background: "#F3F4FF",
    border_color: "#DDDDF5",
    text_color: "#1F2937",
    muted_text_color: "#6B7280",
    nav_background: "#FFFFFF",
    nav_text: "#111827",
    footer_background: "#111827",
    footer_text: "#D1D5DB",
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
