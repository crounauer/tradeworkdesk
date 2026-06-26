import type { Meta, StoryObj } from '@storybook/react-vite';
import { AboutIntroBlock } from '../blocks/AboutIntroBlock';

const meta = {
  title: 'TWD Blocks/About Intro',
  component: AboutIntroBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AboutIntroBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'About us',
    title: 'A local trade business built on practical service',
    body: 'We help homeowners and landlords keep their heating and plumbing systems working properly with clear advice, careful workmanship and dependable support.',
    bullets: ['Oil boiler servicing and repairs', 'Heating upgrades and controls', 'Local service across Aberdeenshire'],
  },
};
