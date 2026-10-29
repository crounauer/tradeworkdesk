export type InvoiceDiscountType = "percentage" | "fixed" | null;

interface ChargeLine {
  quantity: number;
  unit_price: number;
  item_type?: string;
  status?: string | null;
}

export interface InvoiceTotals {
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
}

type TotalsResult = { totals: InvoiceTotals; error?: never } | { totals?: never; error: string };

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateInvoiceTotals(
  lines: ChargeLine[],
  vatRate: number,
  discountType: unknown = null,
  discountValue: unknown = 0,
): TotalsResult {
  if (discountType !== null && discountType !== "percentage" && discountType !== "fixed") {
    return { error: "Discount type must be percentage, fixed or none." };
  }
  if (typeof discountValue !== "number" || !Number.isFinite(discountValue) || discountValue < 0) {
    return { error: "Discount must be a non-negative number." };
  }
  if (Math.abs(discountValue * 100 - Math.round(discountValue * 100)) > 0.000001) {
    return { error: "Discount can have at most two decimal places." };
  }
  if (discountType === null && discountValue !== 0) {
    return { error: "Choose a discount type before entering a discount." };
  }
  if (discountType === "percentage" && discountValue > 100) {
    return { error: "Percentage discount cannot exceed 100%." };
  }
  const rawSubtotal = lines.reduce(
    (sum, line) => line.item_type === "product" && line.status === "to_order"
      ? sum
      : sum + line.quantity * line.unit_price,
    0,
  );
  if (!Number.isFinite(rawSubtotal) || !Number.isFinite(vatRate) || vatRate < 0) {
    return { error: "Invoice prices and VAT rate must be valid numbers." };
  }
  const subtotal = Math.round(rawSubtotal * 100) / 100;
  if (discountType === "fixed" && discountValue > Math.max(0, subtotal)) {
    return { error: "Fixed discount cannot exceed the invoice subtotal." };
  }
  if (discountValue > 0 && subtotal < 0) {
    return { error: "Discounts cannot be applied to a negative invoice subtotal." };
  }
  // Keep historical rounding unchanged on invoices without a discount.
  if (discountValue === 0) {
    const vatAmount = Math.round(rawSubtotal * vatRate) / 100;
    return {
      totals: {
        subtotal,
        discount_amount: 0,
        vat_amount: Math.round(vatAmount * 100) / 100,
        total: Math.round((rawSubtotal + vatAmount) * 100) / 100,
      },
    };
  }
  const discountAmount = discountType === "percentage"
    ? roundMoney(subtotal * discountValue / 100)
    : discountType === "fixed" ? discountValue : 0;
  const taxableAmount = roundMoney(subtotal - discountAmount);
  const vatAmount = roundMoney(taxableAmount * vatRate / 100);
  return {
    totals: {
      subtotal,
      discount_amount: discountAmount,
      vat_amount: vatAmount,
      total: roundMoney(taxableAmount + vatAmount),
    },
  };
}
