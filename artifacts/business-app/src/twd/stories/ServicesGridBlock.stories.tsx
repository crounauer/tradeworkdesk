import type { Meta, StoryObj } from '@storybook/react-vite';
import { ServicesGridBlock } from '../blocks/ServicesGridBlock';

const meta = {
  title: 'TWD Blocks/Services Grid',
  component: ServicesGridBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ServicesGridBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Services',
    title: 'Plumbing and heating services',
    subtitle: 'Core services for homeowners, landlords and small commercial properties.',
    services: [
      { title: 'Oil boiler servicing', description: 'Annual servicing to keep your boiler running safely and efficiently.', href: '/services/oil-boiler-servicing' },
      { title: 'Boiler breakdowns', description: 'Fault finding and repairs when your heating stops working.', href: '/services/boiler-breakdowns' },
      { title: 'Heating upgrades', description: 'Replacement boilers, controls and system improvements.', href: '/services/heating-upgrades' },
    ],
  },
};
