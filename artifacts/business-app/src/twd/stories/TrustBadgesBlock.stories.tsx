import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrustBadgesBlock } from '../blocks/TrustBadgesBlock';

const meta = {
  title: 'TWD Blocks/Trust Badges',
  component: TrustBadgesBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TrustBadgesBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    badges: [
      { label: 'Local business', description: 'Based in the North East and trusted by local homeowners.' },
      { label: 'Clear pricing', description: 'Straightforward advice before work begins.' },
      { label: 'Practical repairs', description: 'Focused on reliable fixes, not unnecessary upselling.' },
    ],
  },
};
