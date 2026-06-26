import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteFooterBlock } from '../blocks/SiteFooterBlock';

const meta = {
  title: 'TWD Blocks/Footer',
  component: SiteFooterBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteFooterBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    logoText: 'North East Eco Heat',
    description: 'Local plumbing and heating support for homeowners and landlords.',
    phone: '01224 000000',
    email: 'hello@example.co.uk',
    navItems: [
      { label: 'Services', href: '/services' },
      { label: 'Areas', href: '/areas-covered' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Contact', href: '/contact' },
    ],
    legalLinks: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Cookie Policy', href: '/cookie-policy' },
      { label: 'Terms', href: '/terms-conditions' },
    ],
  },
};
