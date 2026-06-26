import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegalContentBlock } from '../blocks/LegalContentBlock';

const meta = {
  title: 'TWD Blocks/Legal Content',
  component: LegalContentBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LegalContentBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrivacyPolicy: Story = {
  args: {
    title: 'Privacy Policy',
    updatedDate: '24 June 2026',
    sections: [
      { heading: 'Who we are', body: 'This section explains who operates the website and how visitors can make contact.' },
      { heading: 'Information we collect', body: 'This section explains what information may be collected when a visitor submits an enquiry.' },
      { heading: 'How information is used', body: 'This section explains how enquiry information is used to respond to customers.' },
    ],
  },
};
