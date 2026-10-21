import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScheduleHolidayManager from "./schedule-holiday-manager";

const admin = { id: "assignable-admin", full_name: "Test Engineer", role: "admin" };
let staff: typeof admin[] = [];
let failStaff = false;
let writes: Array<Record<string, unknown>> = [];

function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
  title: "App/Holiday Technician Selection",
  component: ScheduleHolidayManager,
  decorators: [Story => <QueryProvider><Story /></QueryProvider>],
  beforeEach: () => {
    staff = [admin];
    failStaff = false;
    writes = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/company-settings") return Response.json({ custom_leave_types: ["Annual Leave"] });
      if (path === "/api/admin/assignable-users") {
        return failStaff
          ? Response.json({ error: "Staff service unavailable" }, { status: 500 })
          : Response.json(staff);
      }
      if (path === "/api/calendar/holidays") {
        if (init?.method === "POST" && typeof init.body === "string") {
          writes.push(JSON.parse(init.body));
          return Response.json({ id: "leave-block" });
        }
        return Response.json([]);
      }
      throw new Error(`Unexpected test request: ${path}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<typeof ScheduleHolidayManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssignableAdmin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: admin.full_name })).toBeVisible();
    await userEvent.selectOptions(canvas.getByLabelText("Technician"), admin.id);
    await userEvent.click(canvas.getByRole("button", { name: "Add Technician Leave Block" }));
    await expect(writes).toHaveLength(1);
    await expect(writes[0]).toMatchObject({ technician_id: admin.id, name: "Annual Leave" });
  },
};

export const NoAssignableStaff: Story = {
  beforeEach: () => { staff = []; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/No assignable staff found/)).toBeVisible();
    await expect(canvas.getByLabelText("Technician")).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Add Technician Leave Block" })).toBeDisabled();
    await expect(writes).toHaveLength(0);
  },
};

export const RetryStaffFailure: Story = {
  beforeEach: () => { failStaff = true; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Staff service unavailable");
    await expect(canvas.getByLabelText("Technician")).toBeDisabled();
    failStaff = false;
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(await canvas.findByRole("option", { name: admin.full_name })).toBeVisible();
    await expect(canvas.getByLabelText("Technician")).toBeEnabled();
  },
};
