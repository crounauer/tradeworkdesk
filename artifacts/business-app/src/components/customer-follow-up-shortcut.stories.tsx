import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/hooks/use-auth";
import { OfflineProvider } from "@/contexts/offline-context";
import CustomerDetail from "@/pages/customer-detail";

let role = "admin";
let jobManagement = true;
let writes: Array<Record<string, unknown>> = [];

function TestPage() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queryClient.setQueryData(["me-init"], {
      profile: { id: "user-1", role, full_name: "Test User", email: "test@example.com" },
      planFeatures: { features: { job_management: jobManagement } }, activeAddons: [],
    });
    return queryClient;
  });
  const [location] = useState(() => memoryLocation({ path: "/customers/customer-2?addFollowUp=1" }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <OfflineProvider>
          <Router hook={location.hook}>
            <Route path="/customers/:id"><CustomerDetail /></Route>
            <Route path="/follow-ups"><p>Follow-ups list</p></Route>
          </Router>
        </OfflineProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: "App/Customer Follow-Up Shortcut",
  render: () => <TestPage />,
  beforeEach: () => {
    role = "admin";
    jobManagement = true;
    writes = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/me/init") return Response.json({
        profile: { id: "user-1", role, full_name: "Test User", email: "test@example.com" },
        planFeatures: { features: { job_management: jobManagement } }, activeAddons: [],
      });
      if (path === "/api/customers/customer-2") return Response.json({
        id: "customer-2", first_name: "Jamie", last_name: "Jones", created_at: "2025-01-01", properties: [],
      });
      if (path === "/api/jobs") return Response.json({ jobs: [] });
      if (path === "/api/invoices") return Response.json({ invoices: [] });
      if (path === "/api/enquiries") return Response.json([]);
      if (path === "/api/customers/customer-2/email-log") return Response.json([]);
      if (path === "/api/customers/customer-2/portal-status") return Response.json({ has_access: false });
      if (path === "/api/follow-ups" && init?.method === "POST") {
        writes.push(JSON.parse(String(init.body)));
        return Response.json({ id: "follow-up-1" });
      }
      throw new Error(`Unexpected test request: ${path}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateWithoutBooking: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByLabelText("Parts Needed *"), "Replacement valve");
    await userEvent.click(body.getByRole("button", { name: "Create Follow-Up" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await expect(writes[0]).toMatchObject({
      customer_id: "customer-2", original_job_id: null, parts_description: "Replacement valve", expected_parts_date: null,
    });
    await expect(await page.findByText("Follow-ups list")).toBeVisible();
  },
};

export const TechnicianCannotOpen: Story = {
  beforeEach: () => { role = "technician"; },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("heading", { name: "Jamie Jones" })).toBeVisible();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const FeatureDisabledCannotOpen: Story = {
  beforeEach: () => { jobManagement = false; },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("heading", { name: "Jamie Jones" })).toBeVisible();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
