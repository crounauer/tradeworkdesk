import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import {
  modernTradeAboutPage,
  modernTradeAreaDetailPage,
  modernTradeAreasCoveredPage,
  modernTradeBlogIndexPage,
  modernTradeBlogPostPage,
  modernTradeContactPage,
  modernTradeCookiePolicyPage,
  modernTradeFaqPage,
  modernTradeGalleryPage,
  modernTradeHomePage,
  modernTradeNotFoundPage,
  modernTradePrivacyPolicyPage,
  modernTradeReviewsPage,
  modernTradeServiceDetailPage,
  modernTradeServicesPage,
  modernTradeTermsConditionsPage,
} from "../templates/modernTrade.pages";

const meta = {
  title: "TWD Templates/Modern Trade Pages",
  component: TemplatePageRenderer,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { page: modernTradeHomePage },
};

export const About: Story = {
  args: { page: modernTradeAboutPage },
};

export const Services: Story = {
  args: { page: modernTradeServicesPage },
};

export const ServiceDetail: Story = {
  name: "Service Detail",
  args: { page: modernTradeServiceDetailPage },
};

export const AreasCovered: Story = {
  name: "Areas Covered",
  args: { page: modernTradeAreasCoveredPage },
};

export const AreaDetail: Story = {
  name: "Area Detail",
  args: { page: modernTradeAreaDetailPage },
};

export const Reviews: Story = {
  args: { page: modernTradeReviewsPage },
};

export const Gallery: Story = {
  args: { page: modernTradeGalleryPage },
};

export const FAQ: Story = {
  args: { page: modernTradeFaqPage },
};

export const Contact: Story = {
  args: { page: modernTradeContactPage },
};

export const BlogIndex: Story = {
  name: "Blog Index",
  args: { page: modernTradeBlogIndexPage },
};

export const BlogPost: Story = {
  name: "Blog Post",
  args: { page: modernTradeBlogPostPage },
};

export const PrivacyPolicy: Story = {
  name: "Privacy Policy",
  args: { page: modernTradePrivacyPolicyPage },
};

export const CookiePolicy: Story = {
  name: "Cookie Policy",
  args: { page: modernTradeCookiePolicyPage },
};

export const TermsConditions: Story = {
  name: "Terms Conditions",
  args: { page: modernTradeTermsConditionsPage },
};

export const NotFound: Story = {
  name: "404",
  args: { page: modernTradeNotFoundPage },
};
