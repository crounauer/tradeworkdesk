export const DEFAULT_QUOTE_ACCEPTANCE_TEXT =
  "A deposit is required to secure your booking. By accepting this quote, you confirm that you accept our terms and conditions.";

export function getQuoteAdditionalText(customText: unknown): string {
  const custom = typeof customText === "string" ? customText.trim() : "";
  return custom ? `${custom}\n\n${DEFAULT_QUOTE_ACCEPTANCE_TEXT}` : DEFAULT_QUOTE_ACCEPTANCE_TEXT;
}