import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobVisits } from "./job-visits";
import { Toaster } from "@/components/ui/toaster";

const technician = { id: "engineer-1", full_name: "Test Engineer" };
const job = {
  id: "job-1", status: "scheduled", scheduled_date: "2026-11-12",
  scheduled_time: "09:00", estimated_duration: 120, assigned_technician_id: technician.id,
};
type Visit = {
  id: string; scheduled_date: string; scheduled_time: string | null; all_day: boolean;
  estimated_duration: number | null; assigned_technician_id: string | null; notes: string | null;
};
const existing: Visit = {
  id: "visit-1", scheduled_date: "2026-11-16", scheduled_time: "14:00",
  all_day: false, estimated_duration: 120, assigned_technician_id: technician.id, notes: "Continue work",
};
let visits: Visit[] = [];
let writes: Array<{ method: string; body?: Record<string, unknown> }> = [];
let clash = false;

function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>{children}<Toaster /></QueryClientProvider>;
}

const meta = {
  title: "App/Job Visits",
  component: JobVisits,
  args: { job, canManage: true },
  decorators: [Story => <QueryProvider><Story /></QueryProvider>],
  beforeEach: () => {
    visits = [];
    writes = [];
    clash = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
      if (path === "/api/admin/assignable-users") return Response.json([technician]);
      if (path === "/api/jobs/job-1/visits" || path.startsWith("/api/jobs/job-1/visits/")) {
        const method = init?.method || "GET";
        if (method === "GET") return Response.json(visits);
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
        writes.push({ method, body });
        if (clash) return Response.json({ error: "This technician already has job JOB-99 booked all day on 2026-11-16." }, { status: 409 });
        if (method === "DELETE") {
          visits = visits.filter(v => !path.endsWith(`/${v.id}`));
          return new Response(null, { status: 204 });
        }
        const visit = { ...body, id: method === "POST" ? `visit-${visits.length + 1}` : path.split("/").pop() };
        visits = method === "POST" ? [...visits, visit] : visits.map(v => v.id === visit.id ? visit : v);
        return Response.json(visit);
      }
      throw new Error(`Unexpected request: ${path}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<typeof JobVisits>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeparateDatesOnOneJob: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const add = await canvas.findByRole("button", { name: "Add Visit" });
    await waitFor(() => expect(add).toBeEnabled());
    for (const date of ["2026-11-16", "2026-12-05"]) {
      await userEvent.click(canvas.getByRole("button", { name: "Add Visit" }));
      fireEvent.change(canvas.getByLabelText("Visit date"), { target: { value: date } });
      if (date === "2026-12-05") await userEvent.click(canvas.getByRole("checkbox", { name: "All day" }));
      await userEvent.click(canvas.getByRole("button", { name: "Save Visit" }));
      await waitFor(() => expect(canvas.queryByRole("button", { name: "Save Visit" })).not.toBeInTheDocument());
    }
    await expect(writes).toHaveLength(2);
    await expect(writes[0].body).toMatchObject({
      scheduled_date: "2026-11-16", scheduled_time: "09:00", estimated_duration: 120,
      assigned_technician_id: technician.id, all_day: false,
    });
    await expect(writes[1].body).toMatchObject({
      scheduled_date: "2026-12-05", all_day: true, scheduled_time: null, estimated_duration: null,
    });
    await expect(canvas.getByText(/Primary visit:/)).toHaveTextContent("12 Nov 2026");
    await expect(canvas.getAllByRole("button", { name: "Edit visit" })).toHaveLength(2);
  },
};

export const EditOneVisit: Story = {
  beforeEach: () => { visits = [existing]; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Edit visit" }));
    fireEvent.change(canvas.getByLabelText("Visit date"), { target: { value: "2026-12-05" } });
    await userEvent.selectOptions(canvas.getByLabelText("Technician"), "");
    await userEvent.click(canvas.getByRole("button", { name: "Save Visit" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await expect(writes[0]).toMatchObject({
      method: "PATCH", body: { scheduled_date: "2026-12-05", assigned_technician_id: null, notes: "Continue work" },
    });
  },
};

export const RemoveOnlyOneVisit: Story = {
  beforeEach: () => { visits = [existing]; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Remove visit" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("alertdialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Remove visit" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Remove visit" })).not.toBeInTheDocument());
    await expect(writes).toEqual([{ method: "DELETE", body: undefined }]);
    await expect(canvas.getByText(/Primary visit:/)).toBeVisible();
  },
};

export const ClashKeepsFormOpen: Story = {
  beforeEach: () => { visits = [existing]; clash = true; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Edit visit" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save Visit" }));
    await expect(await within(canvasElement.ownerDocument.body).findByText(/This technician already has job JOB-99/)).toBeVisible();
    await expect(canvas.getByLabelText("Visit date")).toHaveValue("2026-11-16");
    await expect(canvas.getByRole("button", { name: "Save Visit" })).toBeEnabled();
  },
};

export const TechnicianReadOnly: Story = {
  args: { canManage: false },
  beforeEach: () => { visits = [existing]; },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Continue work")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Add Visit" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Edit visit" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Remove visit" })).not.toBeInTheDocument();
  },
};
