import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotFoundBlock } from '../blocks/NotFoundBlock';

const meta = {
  title: 'TWD Blocks/404',
  component: NotFoundBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NotFoundBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Page not found',
    subtitle: 'The page you are looking for may have moved or no longer exists.',
    ctaLabel: 'Return home',
    ctaHref: '/',
  },
};
