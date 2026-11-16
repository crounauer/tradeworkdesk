import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SmsSendDialog } from "./sms-send-dialog";

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
