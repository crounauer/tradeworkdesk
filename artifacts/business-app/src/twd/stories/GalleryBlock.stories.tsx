import type { Meta, StoryObj } from '@storybook/react-vite';
import { GalleryBlock } from '../blocks/GalleryBlock';

const meta = {
  title: 'TWD Blocks/Gallery',
  component: GalleryBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GalleryBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Gallery',
    title: 'Recent work',
    images: [
      { alt: 'Boiler installation photo placeholder', caption: 'Replacement boiler installation' },
      { alt: 'Heating controls photo placeholder', caption: 'Heating controls upgrade' },
      { alt: 'Plant room photo placeholder', caption: 'Heating system maintenance' },
    ],
  },
};
