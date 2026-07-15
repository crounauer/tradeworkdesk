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
    accentColor: "#FF6B35",
    primaryColor: "#1F2937",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#FFF7F2",
    mutedBackgroundColor: "#FFE9DE",
    borderColor: "#F2C8B5",
    textColor: "#1F2937",
    mutedTextColor: "#6B7280",
    navBackground: "#FFFFFF",
    navText: "#1F2937",
    footerBackground: "#111827",
    footerText: "#D1D5DB",
  },
  "classic-trade": {
    accentColor: "#B7791F",
    primaryColor: "#5A2E2E",
    primaryTextColor: "#FFF8EE",
    backgroundColor: "#FBF4E8",
    mutedBackgroundColor: "#F2E6D6",
    borderColor: "#DFC7AA",
    textColor: "#3F2A20",
    mutedTextColor: "#7B5E4A",
    navBackground: "#5A2E2E",
    navText: "#FFF8EE",
    footerBackground: "#3D1F1F",
    footerText: "#E9D7C0",
  },
  "professional-trade": {
    accentColor: "#0077B6",
    primaryColor: "#0B2545",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#F4F8FC",
    mutedBackgroundColor: "#E6EEF7",
    borderColor: "#C3D3E6",
    textColor: "#0B2545",
    mutedTextColor: "#4F6B86",
    navBackground: "#0B2545",
    navText: "#FFFFFF",
    footerBackground: "#081A2F",
    footerText: "#BFD2E6",
  },
  "eco-renewables-trade": {
    accentColor: "#2E9B47",
    primaryColor: "#1B4332",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#F3FBF4",
    mutedBackgroundColor: "#E1F1E5",
    borderColor: "#B7D7BF",
    textColor: "#173A2C",
    mutedTextColor: "#4D6F5E",
    navBackground: "#1B4332",
    navText: "#FFFFFF",
    footerBackground: "#122E24",
    footerText: "#B9D5C1",
  },
  "bold-industrial-trade": {
    accentColor: "#FF7A00",
    primaryColor: "#2B2D42",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#F3F4F6",
    mutedBackgroundColor: "#E5E7EB",
    borderColor: "#C7CDD6",
    textColor: "#1F2937",
    mutedTextColor: "#4B5563",
    navBackground: "#2B2D42",
    navText: "#FFFFFF",
    footerBackground: "#1F2233",
    footerText: "#D1D5DB",
  },
  "clean-minimal-trade": {
    accentColor: "#7C3AED",
    primaryColor: "#111827",
    primaryTextColor: "#FFFFFF",
    backgroundColor: "#FCFCFF",
    mutedBackgroundColor: "#F3F4FF",
    borderColor: "#DDDDF5",
    textColor: "#1F2937",
    mutedTextColor: "#6B7280",
    navBackground: "#FFFFFF",
    navText: "#111827",
    footerBackground: "#111827",
    footerText: "#D1D5DB",
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

  // Prefer tokenized theme colors first (new pipeline), then legacy flat keys.
  const accentColor = pickThemeColor(theme, [["tokens", "colors", "accent"], ["accent_color"]], palette.accentColor);
  const primaryColor = pickThemeColor(theme, [["tokens", "colors", "primary"], ["primary_color"]], palette.primaryColor);
  const primaryTextColor = pickThemeColor(theme, [["tokens", "colors", "primaryText"], ["primary_text_color"]], palette.primaryTextColor);
  const backgroundColor = pickThemeColor(theme, [["tokens", "colors", "background"], ["background_color"]], palette.backgroundColor);
  const mutedBackgroundColor = pickThemeColor(theme, [["tokens", "colors", "mutedBackground"], ["muted_background"]], palette.mutedBackgroundColor);
  const borderColor = pickThemeColor(theme, [["tokens", "colors", "border"], ["border_color"]], palette.borderColor);
  const textColor = pickThemeColor(theme, [["tokens", "colors", "text"], ["text_color"]], palette.textColor);
  const mutedTextColor = pickThemeColor(theme, [["tokens", "colors", "mutedText"], ["muted_text_color"]], palette.mutedTextColor);

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
