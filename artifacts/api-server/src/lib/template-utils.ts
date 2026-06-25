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

/**
 * Generate a default theme from design tokens.
 * Includes branded colors, nav/footer colors, and the full design system.
 */
export function generateDefaultTheme(designTokens: Record<string, unknown>): Record<string, unknown> {
  const tokens = (designTokens || {}) as any;
  const colors = tokens.colors || {};

  // Extract primary color for accent, fallback to a teal
  const accentColor = colors.primary || colors.secondary || "#0d9488";

  // Generate nav and footer colors from palette
  // Use darker background if available, otherwise derive from primary
  const navBg = colors.navBackground || colors.background || "#1c2942";
  const navText = colors.navText || colors.foreground || "#ffffff";
  const footerBg = colors.footerBackground || colors.muted || "#111827";
  const footerText = colors.footerText || colors.mutedForeground || "#9ca3af";

  return {
    designTokens: designTokens,
    accent_color: accentColor,
    nav_background: navBg,
    nav_text: navText,
    footer_background: footerBg,
    footer_text: footerText,
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
