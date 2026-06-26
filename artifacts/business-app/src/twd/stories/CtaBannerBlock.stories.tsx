import type { Meta, StoryObj } from '@storybook/react-vite';
import { CtaBannerBlock } from '../blocks/CtaBannerBlock';

const meta = {
  title: 'TWD Blocks/CTA Banner',
  component: CtaBannerBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CtaBannerBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    title: 'Need help with your heating?',
    subtitle: 'Get practical advice and a clear next step from a local trade business.',
    primaryCtaLabel: 'Request a quote',
    secondaryCtaLabel: 'Call now',
    phone: '01224 000000',
  },
};
