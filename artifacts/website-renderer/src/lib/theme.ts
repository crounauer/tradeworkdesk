function normalizeHex(hex: string): string | null {
  const value = String(hex || "").trim();
  if (!value.startsWith("#")) return null;

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  if (value.length === 7) return value.toLowerCase();
  if (value.length === 9) return value.slice(0, 7).toLowerCase();
  return null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return [1, 3, 5].map((start) => Number.parseInt(normalized.slice(start, start + 2), 16)) as [number, number, number];
}

function channelLuminance(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(background: string, foreground: string): number | null {
  const bg = relativeLuminance(background);
  const fg = relativeLuminance(foreground);
  if (bg === null || fg === null) return null;

  const lighter = Math.max(bg, fg);
  const darker = Math.min(bg, fg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function ensureAccessibleTextColor(background: string, preferredText: string, minRatio = 4.5): string {
  const preferredRatio = contrastRatio(background, preferredText);
  if (preferredRatio !== null && preferredRatio >= minRatio) {
    return preferredText;
  }

  const darkOption = "#111827";
  const lightOption = "#ffffff";
  const darkRatio = contrastRatio(background, darkOption) || 0;
  const lightRatio = contrastRatio(background, lightOption) || 0;
  return darkRatio >= lightRatio ? darkOption : lightOption;
}
