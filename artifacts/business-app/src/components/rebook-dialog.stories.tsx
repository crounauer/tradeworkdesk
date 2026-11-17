import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RebookDialog } from "./rebook-dialog";

const sendConfirmation = fn();
const sendSms = fn();
let email: string | null = null;
let smsAvailable = false;
let availabilityFails = false;
let allDay = false;
let mobile: string | null = "07700900000";

function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
  title: "App/Rebook Job",
  component: RebookDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onRebooked: fn(),
    jobId: "job-1",
    originalDate: "2026-11-16",
    originalTime: "09:00",
  },
  decorators: [Story => <QueryProvider><Story /></QueryProvider>],
  beforeEach: () => {
    sendConfirmation.mockClear();
    sendSms.mockClear();
    email = null;
    smsAvailable = false;
    availabilityFails = false;
    allDay = false;
    mobile = "07700900000";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/calendar") return Response.json({ jobs: [] });
      if (path === "/api/jobs/job-1/duplicate") return Response.json({ id: "job-2", job_ref: "JOB-2" });
      if (path === "/api/jobs/job-2") return Response.json({
        id: "job-2", customer_id: "customer-1", scheduled_date: "2027-11-16", scheduled_time: "09:00",
        all_day: allDay, customer: { first_name: "Test", email, mobile },
      });
      if (path === "/api/sms/availability") return availabilityFails
        ? Response.json({ error: "Unavailable" }, { status: 503 })
        : Response.json({ available: smsAvailable });
      if (path === "/api/admin/company-settings") return Response.json({ sms_sender_name: "TradeWork" });
      if (path === "/api/sms/templates") return Response.json([]);
      if (path === "/api/sms/send") {
        sendSms(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, credits_remaining: 10, bundle_size: 1000 });
      }
      if (path === "/api/jobs/job-2/send-confirmation") {
        sendConfirmation();
        return Response.json({ success: true });
      }
      return originalFetch(input, init);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<typeof RebookDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoCustomerEmail: Story = {
  beforeEach: () => { email = "  "; },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm Rebook" }));
    await expect(await canvas.findByText(/No customer email address is available/)).toBeVisible();
    await expect(canvas.getByText(/JOB-2 booked for/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "View job" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Send Confirmation" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(args.onRebooked).toHaveBeenCalledWith("job-2");
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(sendConfirmation).not.toHaveBeenCalled();
  },
};

export const WithCustomerEmail: Story = {
  beforeEach: () => { email = "customer@example.com"; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm Rebook" }));
    await expect(await canvas.findByText("customer@example.com")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Send Confirmation" }));
    await expect(sendConfirmation).toHaveBeenCalledTimes(1);
  },
};

export const SendAppointmentSms: Story = {
  beforeEach: () => { smsAvailable = true; },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm Rebook" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Send confirmation by SMS" }));
    await expect(canvas.getByLabelText("To (phone number)")).toHaveValue("07700900000");
    await expect(canvas.getByLabelText("Message")).toHaveValue("Your appointment is booked for Tuesday, 16 November 2027 at 09:00. Please contact us if you need to change it.");
    await userEvent.click(canvas.getByRole("button", { name: "Send SMS" }));
    await expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({
      job_id: "job-2", customer_id: "customer-1", destination: "07700900000",
      content: expect.stringContaining("16 November 2027 at 09:00"),
    }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const AllDayWithoutPhone: Story = {
  beforeEach: () => { smsAvailable = true; allDay = true; mobile = null; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm Rebook" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Send confirmation by SMS" }));
    await expect(canvas.getByLabelText("To (phone number)")).toHaveValue("");
    await expect(canvas.getByLabelText("Message")).toHaveValue("Your appointment is booked for Tuesday, 16 November 2027. Please contact us if you need to change it.");
    await expect(canvas.getByRole("button", { name: "Send SMS" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("To (phone number)"), "07700900000");
    await expect(canvas.getByRole("button", { name: "Send SMS" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(sendSms).not.toHaveBeenCalled();
  },
};

export const AvailabilityError: Story = {
  beforeEach: () => { availabilityFails = true; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm Rebook" }));
    await expect(await canvas.findByText(/confirmation options could not be checked/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Send confirmation by SMS" })).not.toBeInTheDocument();
  },
};
