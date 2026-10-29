import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoiceTotals } from "@workspace/api-zod/invoice-totals";
import { generateInvoicePdf } from "./invoice-pdf";

const lines = [
  { quantity: 2, unit_price: 40, item_type: "product" },
  { quantity: 1, unit_price: 20, item_type: "labour" },
  { quantity: 1, unit_price: 200, item_type: "product", status: "to_order" },
];

test("invoices without a discount keep existing totals and exclude parts to order", () => {
  assert.deepEqual(calculateInvoiceTotals(lines, 20).totals, {
    subtotal: 100, discount_amount: 0, vat_amount: 20, total: 120,
  });
});

test("no-discount rounding matches historical invoices with fractional quantities", () => {
  for (const quantity of [0.01, 0.125, 0.5, 1, 1.5, 2.75]) {
    for (const unit_price of [0.01, 0.05, 0.1, 0.29, 0.99, 1.005, 19.99, 89.95]) {
      for (const vatRate of [0, 5, 20]) {
        const subtotal = quantity * unit_price;
        const vat = Math.round(subtotal * vatRate) / 100;
        assert.deepEqual(calculateInvoiceTotals([{ quantity, unit_price }], vatRate).totals, {
          subtotal: Math.round(subtotal * 100) / 100,
          discount_amount: 0,
          vat_amount: Math.round(vat * 100) / 100,
          total: Math.round((subtotal + vat) * 100) / 100,
        }, `${quantity} x ${unit_price}, VAT ${vatRate}%`);
      }
    }
  }
});

test("percentage and fixed discounts reduce the VAT base", () => {
  for (const [type, value] of [["percentage", 10], ["fixed", 10]] as const) {
    assert.deepEqual(calculateInvoiceTotals(lines, 20, type, value).totals, {
      subtotal: 100, discount_amount: 10, vat_amount: 18, total: 108,
    });
  }
});

test("discounts support decimals, zero VAT and fully discounted invoices", () => {
  assert.deepEqual(calculateInvoiceTotals(lines, 20, "percentage", 12.5).totals, {
    subtotal: 100, discount_amount: 12.5, vat_amount: 17.5, total: 105,
  });
  assert.deepEqual(calculateInvoiceTotals(lines, 0, "fixed", 12.34).totals, {
    subtotal: 100, discount_amount: 12.34, vat_amount: 0, total: 87.66,
  });
  for (const type of ["percentage", "fixed"] as const) {
    assert.deepEqual(calculateInvoiceTotals(lines, 20, type, 100).totals, {
      subtotal: 100, discount_amount: 100, vat_amount: 0, total: 0,
    });
  }
});

test("discount amounts are rounded to pennies before VAT", () => {
  assert.deepEqual(calculateInvoiceTotals([{ quantity: 1, unit_price: 19.99 }], 20, "percentage", 15).totals, {
    subtotal: 19.99, discount_amount: 3, vat_amount: 3.4, total: 20.39,
  });
  assert.deepEqual(calculateInvoiceTotals([{ quantity: 1, unit_price: 0.05 }], 20, "percentage", 10).totals, {
    subtotal: 0.05, discount_amount: 0.01, vat_amount: 0.01, total: 0.05,
  });
});

test("invalid discounts are rejected rather than clamped or ignored", () => {
  for (const [type, value] of [
    ["percentage", 100.01], ["fixed", 100.01], ["fixed", -1], ["percentage", NaN],
    ["fixed", Infinity], ["fixed", "10"], ["fixed", null], ["fixed", true],
    ["percentage", 0.001], ["other", 1], [null, 10],
  ]) {
    const result = calculateInvoiceTotals(lines, 20, type, value);
    assert.ok(result.error, `${type}: ${value} should fail`);
    assert.equal(result.totals, undefined);
  }
  assert.ok(calculateInvoiceTotals([], 20, "fixed", 1).error);
  assert.ok(calculateInvoiceTotals([{ quantity: 1, unit_price: -10 }], 20, "percentage", 10).error);
});

test("removing a discount restores the original VAT and total", () => {
  assert.deepEqual(calculateInvoiceTotals(lines, 20, null, 0).totals, {
    subtotal: 100, discount_amount: 0, vat_amount: 20, total: 120,
  });
});

test("PDF totals show discounts even for invoices without VAT", () => {
  for (const vatRate of [0, 20]) {
    const calculation = calculateInvoiceTotals(lines, vatRate, "percentage", 10);
    assert.ok(calculation.totals);
    const pdf = generateInvoicePdf({
      type: "invoice", invoice_number: "INV-DISCOUNT", issue_date: "2026-10-29",
      currency: "GBP", customer_name: "Test Customer", line_items: [],
      ...calculation.totals, vat_rate: vatRate, discount_type: "percentage", discount_value: 10,
    }).toString("latin1");
    assert.ok(pdf.includes("Sub Total"));
    assert.ok(pdf.includes("Discount \\(10%\\)"));
    assert.ok(pdf.includes("-"), "discount amount is shown as a deduction");
  }
});
