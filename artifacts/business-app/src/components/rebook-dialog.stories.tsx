import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RebookDialog } from "./rebook-dialog";

const sendConfirmation = fn();

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
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/calendar") return Response.json({ jobs: [] });
      if (path === "/api/jobs/job-1/duplicate") return Response.json({ id: "job-2", job_ref: "JOB-2" });
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
  args: { customerEmail: "  " },
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
  args: { customerEmail: "customer@example.com" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm Rebook" }));
    await expect(await canvas.findByText("customer@example.com")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Send Confirmation" }));
    await expect(sendConfirmation).toHaveBeenCalledTimes(1);
  },
};
