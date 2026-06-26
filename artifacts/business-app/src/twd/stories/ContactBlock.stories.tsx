import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContactBlock } from '../blocks/ContactBlock';

const meta = {
  title: 'TWD Blocks/Contact',
  component: ContactBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ContactBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Contact',
    title: 'Request a quote or ask a question',
    subtitle: 'Tell us what you need help with and we will get back to you.',
    phone: '01224 000000',
    email: 'hello@example.co.uk',
    address: 'Aberdeenshire, Scotland',
    openingHours: 'Monday to Friday, 8am to 5pm',
  },
};
