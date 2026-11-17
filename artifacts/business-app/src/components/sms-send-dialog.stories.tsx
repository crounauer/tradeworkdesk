import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SmsSendDialog } from "./sms-send-dialog";

const sendInvoice = fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  Response.json({ ok: true, credits_remaining: 100, bundle_size: 1000 }));

const meta = {
  title: "App/SMS Template Selection",
  component: SmsSendDialog,
  args: { open: true, onOpenChange: fn(), destination: "07700900000" },
  beforeEach: () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/admin/company-settings") return Response.json({ sms_sender_name: "TradeWork" });
      if (path === "/api/sms/templates") return Response.json([
        { id: "arrival", name: "Arrival", content: "We are on our way." },
        { id: "parts", name: "Parts", content: "Your parts have arrived." },
      ]);
      if (path === "/api/invoices/invoice-1/send-sms") return sendInvoice(input, init);
      return originalFetch(input, init);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<typeof SmsSendDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectTemplate: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const selector = await canvas.findByRole("combobox", { name: "Use a template" });
    await userEvent.click(selector);
    await expect(selector).toHaveFocus();
    await userEvent.selectOptions(selector, "arrival");
    await expect(canvas.getByLabelText("Message")).toHaveValue("We are on our way.");
    await userEvent.selectOptions(selector, "parts");
    await expect(canvas.getByLabelText("Message")).toHaveValue("Your parts have arrived.");
  },
};

export const SendInvoice: Story = {
  args: {
    invoiceOptions: [{ id: "invoice-1", invoice_number: "INV-1", status: "draft" }],
    onSent: fn(),
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.selectOptions(canvas.getByLabelText("Include an invoice"), "invoice-1");
    await expect(canvas.getByText(/valid for 30 days/)).toBeVisible();
    await expect(canvas.getByText(/marked sent after the SMS is accepted/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Send SMS" }));
    await expect(sendInvoice).toHaveBeenCalledWith(
      "/api/invoices/invoice-1/send-sms",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("Please view your invoice:") }),
    );
    await expect(args.onSent).toHaveBeenCalled();
  },
};
