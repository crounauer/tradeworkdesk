import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProcessStepsBlock } from '../blocks/ProcessStepsBlock';

const meta = {
  title: 'TWD Blocks/Process Steps',
  component: ProcessStepsBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProcessStepsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'How it works',
    title: 'Simple process, clear communication',
    steps: [
      { title: 'Get in touch', description: 'Tell us what you need help with and where you are based.' },
      { title: 'Assessment', description: 'We inspect the issue or discuss the work required.' },
      { title: 'Repair or quote', description: 'You receive practical advice and a clear next step.' },
    ],
  },
};
