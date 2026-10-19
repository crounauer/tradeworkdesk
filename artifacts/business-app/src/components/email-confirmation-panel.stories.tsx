import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EmailConfirmationPanel } from "./email-confirmation-panel";

const meta = {
  title: "App/Email Confirmation",
  component: EmailConfirmationPanel,
  parameters: { layout: "padded" },
  args: {
    customerName: "Test Customer",
    customerEmail: "customer@example.com",
    sending: false,
    ccAdmin: false,
    onCcAdminChange: fn(),
    onSend: fn(),
    onSkip: fn(),
  },
} satisfies Meta<typeof EmailConfirmationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Booking: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("customer@example.com")).toBeVisible();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Send a copy to me" }));
    await expect(args.onCcAdminChange).toHaveBeenCalledWith(true);
    await userEvent.click(canvas.getByRole("button", { name: "Send Confirmation" }));
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", { name: "Skip" }));
    await expect(args.onSkip).toHaveBeenCalledTimes(1);
  },
};

export const Enquiry: Story = {
  args: { message: "Would you like to send an enquiry acknowledgement email to the customer?" },
};

export const UpdatedBooking: Story = {
  args: { message: "Would you like to send an updated booking confirmation email to the customer?" },
};

export const Sending: Story = {
  args: { sending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Sending..." })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Skip" })).toBeDisabled();
    await expect(canvas.getByRole("checkbox")).toBeDisabled();
  },
};

export const InvalidRecipient: Story = {
  args: { sendDisabled: true, skipLabel: "Cancel" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Send Confirmation" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(args.onSkip).toHaveBeenCalledTimes(1);
  },
};

export const LongRecipient: Story = {
  decorators: [Story => <div style={{ width: 320, maxWidth: "100%" }}><Story /></div>],
  args: {
    customerName: "LongCustomerName".repeat(8),
    customerEmail: `${"long-email-address".repeat(8)}@example.com`,
  },
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector("div.min-w-0");
    await expect(panel).not.toBeNull();
    if (!(panel instanceof HTMLElement)) throw new Error("Confirmation panel was not rendered");
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    await expect(within(panel).getByRole("button", { name: "Send Confirmation" })).toBeVisible();
    await expect(within(panel).getByRole("button", { name: "Skip" })).toBeVisible();
  },
};
