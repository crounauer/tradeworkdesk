import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroBlock } from '../blocks/HeroBlock';

const meta = {
  title: 'TWD Blocks/Hero',
  component: HeroBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HeroBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Plumbing & heating specialists',
    title: 'Reliable plumbing and heating services across Aberdeenshire',
    subtitle: 'Professional boiler servicing, breakdowns, installations and heating upgrades from a trusted local business.',
    primaryCtaLabel: 'Request a quote',
    secondaryCtaLabel: 'View services',
    phone: '01224 000000',
    imageAlt: 'Engineer working on a heating system',
  },
};
