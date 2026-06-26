import type { Meta, StoryObj } from '@storybook/react-vite';
import { TemplatePageRenderer } from '../templates/TemplatePageRenderer';
import { modernTradeHomePage } from '../templates/modernTradeHome.recipe';

const meta = {
  title: 'TWD Templates/Modern Trade/Home Page',
  component: TemplatePageRenderer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HomePage: Story = {
  args: {
    page: modernTradeHomePage,
  },
};
