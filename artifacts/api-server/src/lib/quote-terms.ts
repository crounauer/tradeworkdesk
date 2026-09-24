export const DEFAULT_QUOTE_ACCEPTANCE_TEXT =
  "A deposit is required to secure your booking. By accepting this quote, you confirm that you accept our terms and conditions.";

export function getQuoteAdditionalText(customText: unknown, paymentTermsDays?: number | null): string {
  const custom = typeof customText === "string" ? customText.trim() : "";
  const balanceDueText = paymentTermsDays && paymentTermsDays > 0
    ? `Remaining balance due within ${paymentTermsDays} days of completion.`
    : "Remaining balance due on the day of completion.";
  const normalizedCustom = custom.replace(
    /Remaining balance due (?:within \d+ days|on the day) of completion\.?/gi,
    balanceDueText,
  );
  return normalizedCustom ? `${normalizedCustom}\n\n${DEFAULT_QUOTE_ACCEPTANCE_TEXT}` : DEFAULT_QUOTE_ACCEPTANCE_TEXT;
}