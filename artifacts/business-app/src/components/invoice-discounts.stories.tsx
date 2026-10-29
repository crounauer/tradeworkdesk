import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import InvoiceDetail from "@/pages/invoice-detail";
import { AuthProvider } from "@/hooks/use-auth";
import { OfflineProvider } from "@/contexts/offline-context";
import { Toaster } from "@/components/ui/toaster";
import type { Invoice } from "@/hooks/use-invoices";
import { calculateInvoiceTotals } from "@workspace/api-zod/invoice-totals";

const initialInvoice: Invoice = {
  id: "discount-invoice", tenant_id: "tenant-1", job_id: "job-1", property_id: null,
  customer_id: "customer-1", type: "invoice", status: "draft", invoice_number: "INV-DISCOUNT",
  issue_date: "2026-10-29", due_date: null, expiry_date: null, currency: "GBP",
  subtotal: 100, vat_rate: 20, vat_amount: 20, total: 120,
  discount_type: null, discount_value: 0, discount_amount: 0,
  works_order: null, notes: null, customer_notes: null,
  estimated_duration_value: null, estimated_duration_unit: null,
  sent_at: null, accepted_at: null, declined_at: null, converted_to_invoice_id: null,
  paid_amount: null, payment_date: null, payment_method: null, payment_reference: null,
  pdf_storage_path: null, created_by: null, created_at: "", updated_at: "",
  customer: { first_name: "Test", last_name: "Customer", email: null, phone: null },
  line_items: [{ description: "Service", quantity: 1, unit_price: 100, item_type: "service" }],
};
let invoice = structuredClone(initialInvoice);
let writes: Array<Record<string, unknown>> = [];
let failSave = false;

function TestPage() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [location] = useState(() => memoryLocation({ path: "/invoices/discount-invoice" }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <OfflineProvider>
          <Router hook={location.hook}>
            <Route path="/invoices/:id"><InvoiceDetail /></Route>
          </Router>
        </OfflineProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: "App/Invoices/Discounts",
  render: () => <TestPage />,
  beforeEach: () => {
    invoice = structuredClone(initialInvoice);
    writes = [];
    failSave = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/invoices/discount-invoice") {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          writes.push(body);
          if (failSave) return Response.json({ error: "Unable to save invoice" }, { status: 500 });
          const result = calculateInvoiceTotals(body.line_items, invoice.vat_rate, body.discount_type, body.discount_value);
          if (result.error) return Response.json({ error: result.error }, { status: 400 });
          invoice = { ...invoice, ...body, ...result.totals };
        }
        return Response.json(invoice);
      }
      if (path === "/api/me/init") return Response.json({
        profile: { id: "admin-1", role: "admin", full_name: "Test Admin", email: "admin@example.com" },
        planFeatures: { features: {} }, activeAddons: [],
      });
      if (path === "/api/company-settings") return Response.json({ currency: "GBP", default_vat_rate: 20 });
      if (path === "/api/customers") return Response.json([{ id: "customer-2", first_name: "Another", last_name: "Customer" }]);
      if (path === "/api/invoices" && init?.method === "POST") {
        writes.push(JSON.parse(String(init.body)));
        return Response.json({ ...invoice, invoice_number: "INV-COPY" });
      }
      if (path === "/api/admin/callout-rates" || path === "/api/invoices/discount-invoice/email-log") return Response.json([]);
      throw new Error(`Unexpected request: ${path}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

async function editDiscount(canvasElement: HTMLElement, type = "Percentage (%)", value = "10") {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "Edit" }));
  await userEvent.click(canvas.getByLabelText("Discount", { exact: true }));
  await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: type }));
  const input = canvas.getByLabelText(type.startsWith("Percentage") ? "Discount percentage" : "Discount amount");
  await userEvent.clear(input);
  await userEvent.type(input, value);
  return canvas;
}

export const PercentageSaveAndRemove: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await editDiscount(canvasElement);
    await expect(canvas.getByText("£108.00", { exact: true })).toBeVisible();
    await expect(canvas.getByText("£18.00", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Save" })).not.toBeInTheDocument());
    await expect(writes[0]).toMatchObject({ discount_type: "percentage", discount_value: 10 });
    await expect(canvas.getByText("Discount (10%)")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
    await expect(canvas.getByLabelText("Discount percentage")).toHaveValue(10);
    await userEvent.click(canvas.getByLabelText("Discount", { exact: true }));
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: "No discount" }));
    await expect(canvas.getByText("£20.00", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    await expect(writes[1]).toMatchObject({ discount_type: null, discount_value: 0 });
  },
};

export const FixedDiscountAndCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await editDiscount(canvasElement, "Fixed amount (GBP)", "12.50");
    await expect(canvas.getByText("£105.00", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(writes).toHaveLength(0);
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
    await expect(canvas.queryByLabelText("Discount amount")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("Discount", { exact: true })).toHaveTextContent("No discount");
  },
};

export const InvalidDiscountBlocksSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await editDiscount(canvasElement, "Percentage (%)", "101");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Percentage discount cannot exceed 100%");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
    const input = canvas.getByLabelText("Discount percentage");
    await userEvent.clear(input);
    await userEvent.type(input, "100");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
    await expect(canvas.getByText("Total", { exact: true, selector: "span" }).parentElement).toHaveTextContent("£0.00");
    await expect(canvas.getByText("VAT (20%)", { exact: true }).parentElement).toHaveTextContent("£0.00");
  },
};

export const SaveErrorKeepsDiscount: Story = {
  beforeEach: () => { failSave = true; },
  play: async ({ canvasElement }) => {
    const canvas = await editDiscount(canvasElement, "Fixed amount (GBP)", "10");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await canvas.findByText("Unable to save invoice");
    await expect(canvas.getByLabelText("Discount amount")).toHaveValue(10);
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
    await expect(writes).toHaveLength(1);
  },
};

export const FixedDiscountWithoutVat: Story = {
  beforeEach: () => { invoice = { ...invoice, vat_rate: 0, vat_amount: 0, total: 100 }; },
  play: async ({ canvasElement }) => {
    const canvas = await editDiscount(canvasElement, "Fixed amount (GBP)", "12.34");
    await expect(canvas.getByText("£87.66", { exact: true })).toBeVisible();
    await expect(canvas.getByText("VAT (0%)", { exact: true }).parentElement).toHaveTextContent("£0.00");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await expect(writes[0]).toMatchObject({ discount_type: "fixed", discount_value: 12.34 });
  },
};

export const SentInvoiceIsReadOnly: Story = {
  beforeEach: () => {
    invoice = { ...invoice, status: "sent", discount_type: "percentage", discount_value: 10, discount_amount: 10, vat_amount: 18, total: 108 };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Discount (10%)");
    await expect(canvas.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText("Discount percentage")).not.toBeInTheDocument();
  },
};

export const DuplicatePreservesDiscount: Story = {
  beforeEach: () => {
    invoice = { ...invoice, discount_type: "fixed", discount_value: 12.5, discount_amount: 12.5, vat_amount: 17.5, total: 105 };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Duplicate/ }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.type(dialog.getByPlaceholderText("Name, phone, email or postcode…"), "Another");
    await userEvent.click(await dialog.findByRole("button", { name: "Another Customer" }));
    await userEvent.click(dialog.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await expect(writes[0]).toMatchObject({
      customer_id: "customer-2", discount_type: "fixed", discount_value: 12.5,
    });
  },
};
