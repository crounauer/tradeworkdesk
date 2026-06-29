import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import { getModernTradePageByMode } from "../content/modernTradeContentModes";

const meta = {
  title: "TWD Templates/Modern Trade/Content Modes",
  component: TemplatePageRenderer,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DemoMode: Story = {
  name: "Home - Demo",
  args: {
    page: getModernTradePageByMode("home", "demo"),
  },
};

export const EmptyMode: Story = {
  name: "Home - Empty",
  args: {
    page: getModernTradePageByMode("home", "empty"),
  },
};

export const AiMode: Story = {
  name: "Home - AI Scaffold",
  args: {
    page: getModernTradePageByMode("home", "ai"),
  },
};
