import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeatureListBlock } from '../blocks/FeatureListBlock';

const meta = {
  title: 'TWD Blocks/Features List',
  component: FeatureListBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FeatureListBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Why choose us',
    title: 'Straightforward service from start to finish',
    subtitle: 'A practical approach for customers who want clear answers and reliable workmanship.',
    features: [
      { title: 'Local knowledge', description: 'Experience with rural properties, oil heating and heating systems common across the area.' },
      { title: 'No nonsense advice', description: 'You get clear options without pressure or confusing sales talk.' },
      { title: 'Tidy workmanship', description: 'Work is carried out carefully with respect for your home.' },
      { title: 'Reliable communication', description: 'Customers are kept informed before, during and after the job.' },
    ],
  },
};
