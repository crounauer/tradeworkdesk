import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getListCustomersQueryKey } from "@workspace/api-client-react";
import { QuickEnquiryDialog } from "./quick-enquiry-dialog";

const initData = {
  planFeatures: { features: { uk_address_lookup: false } },
  activeAddons: [],
};
let writes: Array<Record<string, unknown>> = [];
let failNextRequest = false;

function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queryClient.setQueryData(["me-init"], initData);
    queryClient.setQueryData(getListCustomersQueryKey(), []);
    return queryClient;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
  title: "App/Enquiry Confirmation Flow",
  component: QuickEnquiryDialog,
  args: { open: true, onOpenChange: fn() },
  decorators: [Story => <QueryProvider><Story /></QueryProvider>],
  beforeEach: () => {
    writes = [];
    failNextRequest = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/me/init") return Response.json(initData);
      if (path === "/api/customers") return Response.json([]);
      if (path === "/api/enquiries" && init?.method === "POST" && typeof init.body === "string") {
        const body = JSON.parse(init.body);
        writes.push(body);
        if (failNextRequest) {
          failNextRequest = false;
          return Response.json({ error: "Unable to create enquiry" }, { status: 500 });
        }
        return Response.json({ id: "test-enquiry", acknowledgement_email_sent: body.send_acknowledgement_email });
      }
      throw new Error(`Unexpected test request: ${path}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<typeof QuickEnquiryDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

async function fillEnquiry(canvasElement: HTMLElement, email = "customer@example.com") {
  const canvas = within(canvasElement.ownerDocument.body);
  await userEvent.type(canvas.getByPlaceholderText("John"), "Test");
  await userEvent.type(canvas.getByPlaceholderText("Smith"), "Customer");
  if (email) await userEvent.type(canvas.getByPlaceholderText("john@example.com"), email);
  await userEvent.click(canvas.getByRole("button", { name: "Add Enquiry" }));
  return canvas;
}

export const SendWithCopy: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = await fillEnquiry(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Send Enquiry Confirmation?" })).toBeVisible();
    await expect(writes).toHaveLength(0);
    await userEvent.click(canvas.getByRole("checkbox", { name: "Send a copy to me" }));
    await userEvent.click(canvas.getByRole("button", { name: "Send Confirmation" }));
    await expect(writes).toHaveLength(1);
    await expect(writes[0]).toMatchObject({
      contact_name: "Test Customer",
      send_acknowledgement_email: true,
      cc_admin: true,
    });
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const SkipEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await fillEnquiry(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Skip" }));
    await expect(writes).toHaveLength(1);
    await expect(writes[0]).toMatchObject({ send_acknowledgement_email: false, cc_admin: false });
  },
};

export const WithoutEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await fillEnquiry(canvasElement, "");
    await expect(writes).toHaveLength(1);
    await expect(writes[0]).toMatchObject({ send_acknowledgement_email: false });
    await expect(canvas.queryByRole("button", { name: "Send Confirmation" })).not.toBeInTheDocument();
  },
};

export const RetryAfterFailure: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = await fillEnquiry(canvasElement);
    failNextRequest = true;
    await userEvent.click(canvas.getByRole("button", { name: "Send Confirmation" }));
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: "Send Confirmation" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Send Confirmation" }));
    await expect(writes).toHaveLength(2);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const DismissWithoutCreating: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = await fillEnquiry(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(writes).toHaveLength(0);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
