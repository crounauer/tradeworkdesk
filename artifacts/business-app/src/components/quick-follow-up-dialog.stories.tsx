import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickFollowUpDialog } from "./quick-follow-up-dialog";

let failRequest = false;
let emptyCustomers = false;

function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
  title: "App/Quick Follow-Up",
  component: QuickFollowUpDialog,
  args: { onClose: fn(), onSelectCustomer: fn() },
  decorators: [Story => <QueryProvider><Story /></QueryProvider>],
  beforeEach: () => {
    failRequest = false;
    emptyCustomers = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/customers") {
        if (failRequest) return Response.json({ error: "Unavailable" }, { status: 503 });
        return Response.json(emptyCustomers ? [] : [
          { id: "customer-1", first_name: "Alex", last_name: "Smith" },
          { id: "customer-2", first_name: "Jamie", last_name: "Jones" },
        ]);
      }
      throw new Error(`Unexpected test request: ${path}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<typeof QuickFollowUpDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectCustomer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const search = await canvas.findByPlaceholderText("Search customers...");
    await userEvent.click(search);
    await userEvent.type(search, "Jamie");
    await userEvent.click(canvas.getByRole("button", { name: "Jamie Jones" }));
    await expect(args.onSelectCustomer).toHaveBeenCalledWith("customer-2");
  },
};

export const RetryAfterLoadFailure: Story = {
  beforeEach: () => { failRequest = true; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText("Unable to load customers.")).toBeVisible();
    failRequest = false;
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(await canvas.findByPlaceholderText("Search customers...")).toBeVisible();
  },
};

export const NoCustomers: Story = {
  beforeEach: () => { emptyCustomers = true; },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText("Add a customer first to create a follow-up.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
