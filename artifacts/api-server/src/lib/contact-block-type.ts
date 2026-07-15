const CONTACT_BLOCK_TYPE_ALIASES: Record<string, string> = {
  contact_form_section: "contact_form",
  map_opening_hours: "contact",
  "contact.split": "contact",
};

export function normalizeContactBlockType(blockType: unknown): string {
  const normalized = String(blockType || "").trim().toLowerCase();
  if (!normalized) return "";
  return CONTACT_BLOCK_TYPE_ALIASES[normalized] || normalized;
}

export function isContactLikeBlockType(blockType: unknown): boolean {
  const resolved = normalizeContactBlockType(blockType);
  return resolved === "contact" || resolved === "contact_form";
}
