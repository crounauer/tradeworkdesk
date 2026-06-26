import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReviewsBlock } from '../blocks/ReviewsBlock';

const meta = {
  title: 'TWD Blocks/Reviews',
  component: ReviewsBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReviewsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Reviews',
    title: 'What customers say',
    reviews: [
      { quote: 'Arrived when agreed, explained the issue clearly and got the boiler running again.', name: 'Customer', location: 'Ellon', rating: 5 },
      { quote: 'Professional service and tidy work. Would happily use again.', name: 'Customer', location: 'Inverurie', rating: 5 },
      { quote: 'Helpful advice and a straightforward repair without any fuss.', name: 'Customer', location: 'Peterhead', rating: 5 },
    ],
  },
};
