export function getAddonDisplayName(name: string | null | undefined, featureKeys?: string[] | null): string {
  const raw = String(name || "").trim();
  const keys = featureKeys || [];

  if (keys.includes("ai_blog_writing")) return "AI Helper";
  if (raw.toLowerCase() === "ai blog writing") return "AI Helper";
  return raw;
}
