import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaqBlock } from '../blocks/FaqBlock';

const meta = {
  title: 'TWD Blocks/FAQ',
  component: FaqBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FaqBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'FAQ',
    title: 'Common questions',
    faqs: [
      { question: 'Do you service oil boilers?', answer: 'Yes, this template supports oil boiler servicing content and can be adapted for other heating services.' },
      { question: 'Can customers request a quote online?', answer: 'Yes, this block structure can be connected to your future TWD enquiry form.' },
      { question: 'Can the areas be edited?', answer: 'Yes, areas are passed in as editable data and can be mapped to CMS fields later.' },
    ],
  },
};
