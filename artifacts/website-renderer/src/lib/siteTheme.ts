export type ThemeLike = Record<string, unknown> | null | undefined;

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
  const slug = String(templateSlug || "").toLowerCase();
  const isModernTrade = slug === "modern-trade";

  const accentColor = pickThemeColor(theme, [["accent_color"], ["tokens", "colors", "accent"]], isModernTrade ? "#fbbf24" : "#f97316");
  const primaryColor = pickThemeColor(theme, [["primary_color"], ["tokens", "colors", "primary"]], isModernTrade ? "#020617" : "#1c2942");
  const primaryTextColor = pickThemeColor(theme, [["primary_text_color"], ["tokens", "colors", "primaryText"]], "#ffffff");
  const backgroundColor = pickThemeColor(theme, [["background_color"], ["tokens", "colors", "background"]], "#ffffff");
  const mutedBackgroundColor = pickThemeColor(theme, [["muted_background"], ["tokens", "colors", "mutedBackground"]], "#f8fafc");
  const borderColor = pickThemeColor(theme, [["border_color"], ["tokens", "colors", "border"]], "#e2e8f0");
  const textColor = pickThemeColor(theme, [["text_color"], ["tokens", "colors", "text"]], "#111827");
  const mutedTextColor = pickThemeColor(theme, [["muted_text_color"], ["tokens", "colors", "mutedText"]], "#475569");

  const navBackground = pickThemeColor(theme, [["nav_background"]], isModernTrade ? "#ffffff" : primaryColor);
  const navText = pickThemeColor(theme, [["nav_text"]], isModernTrade ? "#0f172a" : primaryTextColor);
  const footerBackground = pickThemeColor(theme, [["footer_background"]], primaryColor);
  const footerText = pickThemeColor(theme, [["footer_text"]], mutedTextColor);

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
