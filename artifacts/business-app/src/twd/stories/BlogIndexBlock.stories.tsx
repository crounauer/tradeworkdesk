import type { Meta, StoryObj } from '@storybook/react-vite';
import { BlogIndexBlock } from '../blocks/BlogIndexBlock';

const meta = {
  title: 'TWD Blocks/Blog Index',
  component: BlogIndexBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BlogIndexBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Advice',
    title: 'Latest heating advice',
    posts: [
      { title: 'How often should an oil boiler be serviced?', excerpt: 'A simple guide for homeowners who want to keep their boiler safe and efficient.', href: '/blog/oil-boiler-service', date: '12 June 2026' },
      { title: 'Signs your heating system needs attention', excerpt: 'Common warning signs that should not be ignored.', href: '/blog/heating-warning-signs', date: '18 June 2026' },
      { title: 'Choosing better heating controls', excerpt: 'How modern controls can improve comfort and reduce wasted energy.', href: '/blog/heating-controls', date: '24 June 2026' },
    ],
  },
};
