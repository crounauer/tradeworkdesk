export function mergeTemplateBlockContent(
  content: Record<string, unknown> | null | undefined,
  settings: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const safeContent = content || {};
  const safeSettings = settings || {};
  if (Object.keys(safeSettings).length === 0) {
    return safeContent;
  }

  return {
    ...safeContent,
    settings: safeSettings,
  };
}
