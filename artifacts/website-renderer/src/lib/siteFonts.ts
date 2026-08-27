/**
 * Site-level typography options.
 *
 * The theme stores the full CSS font stack so blocks can use the value directly;
 * matching a stack back to this list tells us which web font to load.
 */
export type SiteFontOption = {
  label: string;
  stack: string;
  /** Google Fonts family spec, omitted for system stacks. */
  google?: string;
};

export const SITE_FONT_OPTIONS: SiteFontOption[] = [
  { label: "System", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { label: "Inter", stack: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700" },
  { label: "Poppins", stack: "'Poppins', system-ui, sans-serif", google: "Poppins:wght@400;500;600;700" },
  { label: "Montserrat", stack: "'Montserrat', system-ui, sans-serif", google: "Montserrat:wght@400;500;600;700" },
  { label: "Lato", stack: "'Lato', system-ui, sans-serif", google: "Lato:wght@400;700" },
  { label: "Open Sans", stack: "'Open Sans', system-ui, sans-serif", google: "Open+Sans:wght@400;600;700" },
  { label: "Roboto", stack: "'Roboto', system-ui, sans-serif", google: "Roboto:wght@400;500;700" },
  { label: "Work Sans", stack: "'Work Sans', system-ui, sans-serif", google: "Work+Sans:wght@400;500;600;700" },
  { label: "Source Sans 3", stack: "'Source Sans 3', system-ui, sans-serif", google: "Source+Sans+3:wght@400;600;700" },
  { label: "Oswald", stack: "'Oswald', system-ui, sans-serif", google: "Oswald:wght@400;500;600" },
  { label: "Merriweather", stack: "'Merriweather', Georgia, serif", google: "Merriweather:wght@400;700" },
  { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;600;700" },
];

const THEME_FONT_KEYS = ["heading_font_family", "body_font_family", "button_font_family"] as const;

function readStack(theme: Record<string, unknown>, key: string): string | undefined {
  const value = theme[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveThemeFonts(theme: Record<string, unknown> | null | undefined): {
  heading?: string;
  body?: string;
  button?: string;
  googleHref?: string;
} {
  const themeObj = (theme && typeof theme === "object") ? theme : {};
  const heading = readStack(themeObj, "heading_font_family");
  const body = readStack(themeObj, "body_font_family");
  const button = readStack(themeObj, "button_font_family");

  const families = new Set<string>();
  for (const key of THEME_FONT_KEYS) {
    const stack = readStack(themeObj, key);
    if (!stack) continue;
    const match = SITE_FONT_OPTIONS.find((option) => option.stack === stack);
    if (match?.google) families.add(match.google);
  }

  const googleHref = families.size > 0
    ? `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join("&")}&display=swap`
    : undefined;

  return { heading, body, button, googleHref };
}
