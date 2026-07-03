export type ThemeLike = Record<string, unknown> | null | undefined;

type TemplatePalette = {
  accentColor: string;
  primaryColor: string;
  primaryTextColor: string;
  backgroundColor: string;
  mutedBackgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
  navBackground: string;
  navText: string;
  footerBackground: string;
  footerText: string;
};

const DEFAULT_TEMPLATE_PALETTE: TemplatePalette = {
  accentColor: "#f97316",
  primaryColor: "#1c2942",
  primaryTextColor: "#ffffff",
  backgroundColor: "#ffffff",
  mutedBackgroundColor: "#f8fafc",
  borderColor: "#e2e8f0",
  textColor: "#111827",
  mutedTextColor: "#475569",
  navBackground: "#1c2942",
  navText: "#ffffff",
  footerBackground: "#111827",
  footerText: "#9ca3af",
};

const TEMPLATE_PALETTES: Record<string, TemplatePalette> = {
  "modern-trade": {
    accentColor: "#F59E0B",
    primaryColor: "#0F172A",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#F8FAFC",
    mutedBackgroundColor: "#EEF2F7",
    borderColor: "#CBD5E1",
    textColor: "#0F172A",
    mutedTextColor: "#475569",
    navBackground: "#FFFFFF",
    navText: "#0F172A",
    footerBackground: "#0B1220",
    footerText: "#94A3B8",
  },
  "classic-trade": {
    accentColor: "#C78A2C",
    primaryColor: "#1E2A3A",
    primaryTextColor: "#F8F5EE",
    backgroundColor: "#F7F3EC",
    mutedBackgroundColor: "#EFE7DA",
    borderColor: "#D8CBB4",
    textColor: "#2A241B",
    mutedTextColor: "#6E6250",
    navBackground: "#1E2A3A",
    navText: "#F8F5EE",
    footerBackground: "#151E2A",
    footerText: "#C9BFAF",
  },
  "professional-trade": {
    accentColor: "#2563EB",
    primaryColor: "#0B3A6E",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#F8FBFF",
    mutedBackgroundColor: "#EAF2FC",
    borderColor: "#C8D9EE",
    textColor: "#0F2942",
    mutedTextColor: "#4A6A88",
    navBackground: "#0B3A6E",
    navText: "#FFFFFF",
    footerBackground: "#082B52",
    footerText: "#B9CCE3",
  },
  "eco-renewables-trade": {
    accentColor: "#65A30D",
    primaryColor: "#1F4D2E",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#F5FAF4",
    mutedBackgroundColor: "#E6F2E5",
    borderColor: "#BFD9C2",
    textColor: "#1F3A27",
    mutedTextColor: "#557462",
    navBackground: "#1F4D2E",
    navText: "#FFFFFF",
    footerBackground: "#173A23",
    footerText: "#A8C2AE",
  },
  "bold-industrial-trade": {
    accentColor: "#F97316",
    primaryColor: "#111827",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#FFF7ED",
    mutedBackgroundColor: "#FFECD6",
    borderColor: "#F5CBA7",
    textColor: "#1F2937",
    mutedTextColor: "#7C5A3B",
    navBackground: "#111827",
    navText: "#FFFFFF",
    footerBackground: "#0B1220",
    footerText: "#C9D2E0",
  },
  "clean-minimal-trade": {
    accentColor: "#0EA5A4",
    primaryColor: "#0F172A",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#FAFAF9",
    mutedBackgroundColor: "#F1F5F9",
    borderColor: "#DDE5EC",
    textColor: "#1E293B",
    mutedTextColor: "#64748B",
    navBackground: "#FFFFFF",
    navText: "#0F172A",
    footerBackground: "#111827",
    footerText: "#CBD5E1",
  },
};

function getTemplatePalette(templateSlug?: string | null): TemplatePalette {
  const slug = String(templateSlug || "").toLowerCase();
  return TEMPLATE_PALETTES[slug] || DEFAULT_TEMPLATE_PALETTE;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readThemePath(theme: ThemeLike, path: string[]): string | undefined {
  let current: unknown = theme;

  for (const part of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return readString(current);
}

function pickThemeColor(theme: ThemeLike, paths: string[][], fallback: string): string {
  for (const path of paths) {
    const value = readThemePath(theme, path);
    if (value) return value;
  }
  return fallback;
}

export type NormalizedSiteTheme = {
  accentColor: string;
  primaryColor: string;
  primaryTextColor: string;
  backgroundColor: string;
  mutedBackgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
  navBackground: string;
  navText: string;
  footerBackground: string;
  footerText: string;
};

export function resolveSiteTheme(theme: ThemeLike, templateSlug?: string | null): NormalizedSiteTheme {
  const palette = getTemplatePalette(templateSlug);

  const accentColor = pickThemeColor(theme, [["accent_color"], ["tokens", "colors", "accent"]], palette.accentColor);
  const primaryColor = pickThemeColor(theme, [["primary_color"], ["tokens", "colors", "primary"]], palette.primaryColor);
  const primaryTextColor = pickThemeColor(theme, [["primary_text_color"], ["tokens", "colors", "primaryText"]], palette.primaryTextColor);
  const backgroundColor = pickThemeColor(theme, [["background_color"], ["tokens", "colors", "background"]], palette.backgroundColor);
  const mutedBackgroundColor = pickThemeColor(theme, [["muted_background"], ["tokens", "colors", "mutedBackground"]], palette.mutedBackgroundColor);
  const borderColor = pickThemeColor(theme, [["border_color"], ["tokens", "colors", "border"]], palette.borderColor);
  const textColor = pickThemeColor(theme, [["text_color"], ["tokens", "colors", "text"]], palette.textColor);
  const mutedTextColor = pickThemeColor(theme, [["muted_text_color"], ["tokens", "colors", "mutedText"]], palette.mutedTextColor);

  const navBackground = pickThemeColor(theme, [["nav_background"]], palette.navBackground);
  const navText = pickThemeColor(theme, [["nav_text"]], palette.navText);
  const footerBackground = pickThemeColor(theme, [["footer_background"]], palette.footerBackground);
  const footerText = pickThemeColor(theme, [["footer_text"]], palette.footerText);

  return {
    accentColor,
    primaryColor,
    primaryTextColor,
    backgroundColor,
    mutedBackgroundColor,
    borderColor,
    textColor,
    mutedTextColor,
    navBackground,
    navText,
    footerBackground,
    footerText,
  };
}

export function isModernTemplateContent(content: Record<string, unknown>): boolean {
  const slug = String(content.template_slug || content.templateSlug || "").toLowerCase();
  if (slug === "modern-trade") return true;

  const variant = String(content.variant || content.heroStyle || content.layoutVariant || "").toLowerCase();
  return variant === "modern";
}
