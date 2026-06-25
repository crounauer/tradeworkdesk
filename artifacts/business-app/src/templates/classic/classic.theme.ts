import type { WebsiteTheme } from "@/features/website-builder/websiteBuilderTypes";

export const classicTheme: WebsiteTheme = {
  name: "Classic",
  colors: {
    primary: "#1A2F5E",
    accent: "#F97316",
    background: "#ffffff",
    card: "#f8fafc",
    border: "#e2e8f0",
    foreground: "#0f172a",
    mutedForeground: "#64748b",
  },
  fonts: {
    heading: "Merriweather, serif",
    body: "Inter, sans-serif",
  },
};
