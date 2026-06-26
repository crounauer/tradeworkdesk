export type TemplatePageForValidation = {
  blocks: Array<{ block_type: string }>;
};

export function findUnsupportedBlockTypes(
  pages: TemplatePageForValidation[],
  supportedBlockTypes: Set<string>,
): string[] {
  if (supportedBlockTypes.size === 0) return [];

  const unsupported = new Set<string>();
  for (const page of pages) {
    for (const block of page.blocks) {
      const normalized = String(block.block_type || "").trim().toLowerCase();
      if (!normalized) continue;
      if (!supportedBlockTypes.has(normalized)) {
        unsupported.add(block.block_type);
      }
    }
  }

  return Array.from(unsupported);
}
