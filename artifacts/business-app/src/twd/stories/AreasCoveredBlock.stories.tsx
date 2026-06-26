import type { Meta, StoryObj } from '@storybook/react-vite';
import { AreasCoveredBlock } from '../blocks/AreasCoveredBlock';

const meta = {
  title: 'TWD Blocks/Areas Covered',
  component: AreasCoveredBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AreasCoveredBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Areas covered',
    title: 'Serving homes across the North East',
    subtitle: 'Local plumbing and heating support across towns and rural areas.',
    areas: [
      { name: 'Ellon', href: '/areas/ellon' },
      { name: 'Inverurie', href: '/areas/inverurie' },
      { name: 'Peterhead', href: '/areas/peterhead' },
      { name: 'Aberdeen', href: '/areas/aberdeen' },
      { name: 'Oldmeldrum', href: '/areas/oldmeldrum' },
      { name: 'Mintlaw', href: '/areas/mintlaw' },
      { name: 'Newburgh', href: '/areas/newburgh' },
      { name: 'Balmedie', href: '/areas/balmedie' },
    ],
  },
};
