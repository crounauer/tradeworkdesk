import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteHeaderBlock } from '../blocks/SiteHeaderBlock';

const meta = {
  title: 'TWD Blocks/Header',
  component: SiteHeaderBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteHeaderBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    logoText: 'North East Eco Heat',
    navItems: [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Areas', href: '/areas-covered' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Contact', href: '/contact' },
    ],
    phone: '01224 000000',
    ctaLabel: 'Book a visit',
    ctaHref: '#contact',
  },
};
