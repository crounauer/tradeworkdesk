import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PartsSection } from "./parts-section";
import { ServicesSection } from "./services-section";

const onAdd = fn();
let writes: Array<{ path: string; body: Record<string, unknown> }> = [];

const meta = {
  title: "App/Line Items/Catalogue Search",
  args: { type: "product", canEditCatalogue: true },
  render: ({ type, canEditCatalogue }) => {
    const common = { canEditCatalogue, onAdd, onUpdate: fn(), onDelete: fn() };
    return type === "product"
      ? <PartsSection parts={[]} {...common} />
      : <ServicesSection services={[]} {...common} />;
  },
  beforeEach: () => {
    writes = [];
    onAdd.mockClear();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
      if (url.pathname === "/api/products/search" || url.pathname === "/api/services/search") {
        await new Promise(resolve => setTimeout(resolve, 350));
        const query = url.searchParams.get("q") || "";
        return Response.json(query.startsWith("No match") ? [] : [{
          id: "existing-item",
          name: query.startsWith("Exact") ? "  EXACT ITEM  " : "Existing gasket",
          default_price: 12,
        }]);
      }
      if (init?.method === "POST" && ["/api/admin/products", "/api/admin/service-catalogue"].includes(url.pathname)) {
        const body = JSON.parse(String(init.body));
        writes.push({ path: url.pathname, body });
        return Response.json({ id: "created-item", ...body });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    };
    return () => { globalThis.fetch = originalFetch; };
  },
} satisfies Meta<{ type: "product" | "service"; canEditCatalogue: boolean }>;

export default meta;
type Story = StoryObj<typeof meta>;

const createWithPartialMatches: NonNullable<Story["play"]> = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const [name, , price] = canvas.getAllByRole("textbox");
  await userEvent.type(name, "No match");
  await canvas.findByRole("button", { name: '+ Add "No match" to catalogue' });
  await userEvent.clear(name);
  await userEvent.type(name, "New gasket");
  await canvas.findByRole("button", { name: /Existing gasket/ });
  await expect(canvas.getByRole("button", { name: '+ Add "New gasket" to catalogue' })).toBeVisible();

  await userEvent.click(price);
  await userEvent.type(price, "18.50");
  await expect(canvas.queryByRole("button", { name: /to catalogue/ })).not.toBeInTheDocument();
  await userEvent.click(name);
  await canvas.findByRole("button", { name: /Existing gasket/ });
  await expect(name).toHaveValue("New gasket");

  // Keyboard focus must stay inside the dropdown without a delayed blur closing it.
  await userEvent.tab();
  await expect(canvas.getByRole("button", { name: /Existing gasket/ })).toHaveFocus();
  await new Promise(resolve => setTimeout(resolve, 300));
  await userEvent.tab();
  await expect(canvas.getByRole("button", { name: '+ Add "New gasket" to catalogue' })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(writes).toEqual([{
    path: args.type === "product" ? "/api/admin/products" : "/api/admin/service-catalogue",
    body: { name: "New gasket", default_price: 18.5 },
  }]));
  await waitFor(() => expect(canvas.queryByRole("button", { name: /to catalogue/ })).not.toBeInTheDocument());
  await userEvent.click(canvas.getByRole("button", { name: "Add" }));
  await expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
    name: "New gasket", unitPrice: 18.5, catalogueItemId: "created-item",
  }));
};

const exactMatch: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getAllByRole("textbox")[0], "Exact item");
  await canvas.findByRole("button", { name: /EXACT ITEM/ });
  await expect(canvas.queryByRole("button", { name: /to catalogue/ })).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", { name: /EXACT ITEM/ }));
  await userEvent.click(canvas.getByRole("button", { name: "Add" }));
  await expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
    catalogueItemId: "existing-item", unitPrice: 12,
  }));
  await expect(writes).toHaveLength(0);
};

const withoutPermission: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getAllByRole("textbox")[0], "No match");
  await canvas.findByText(/No matching/);
  await expect(canvas.queryByRole("button", { name: /to catalogue/ })).not.toBeInTheDocument();
};

export const PartsWithPartialMatches: Story = { play: createWithPartialMatches };
export const ServicesWithPartialMatches: Story = { args: { type: "service" }, play: createWithPartialMatches };
export const PartsExactMatch: Story = { play: exactMatch };
export const ServicesExactMatch: Story = { args: { type: "service" }, play: exactMatch };
export const PartsWithoutPermission: Story = { args: { canEditCatalogue: false }, play: withoutPermission };
export const ServicesWithoutPermission: Story = {
  args: { type: "service", canEditCatalogue: false }, play: withoutPermission,
};
