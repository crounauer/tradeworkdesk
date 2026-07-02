import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import {
  cleanMinimalTradeAboutPage,
  cleanMinimalTradeAreaDetailPage,
  cleanMinimalTradeAreasCoveredPage,
  cleanMinimalTradeBlogIndexPage,
  cleanMinimalTradeBlogPostPage,
  cleanMinimalTradeContactPage,
  cleanMinimalTradeCookiePolicyPage,
  cleanMinimalTradeFaqPage,
  cleanMinimalTradeGalleryPage,
  cleanMinimalTradeHomePage,
  cleanMinimalTradeNotFoundPage,
  cleanMinimalTradePrivacyPolicyPage,
  cleanMinimalTradeReviewsPage,
  cleanMinimalTradeServiceDetailPage,
  cleanMinimalTradeServicesPage,
  cleanMinimalTradeTermsConditionsPage,
} from "../templates/cleanMinimalTrade.pages";

const meta = {
  title: "TWD Templates / Clean Minimal Trade Pages",
  component: TemplatePageRenderer,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { page: cleanMinimalTradeHomePage },
};

export const About: Story = {
  args: { page: cleanMinimalTradeAboutPage },
};

export const Services: Story = {
  args: { page: cleanMinimalTradeServicesPage },
};

export const ServiceDetail: Story = {
  name: "Service Detail",
  args: { page: cleanMinimalTradeServiceDetailPage },
};

export const AreasCovered: Story = {
  name: "Areas Covered",
  args: { page: cleanMinimalTradeAreasCoveredPage },
};

export const AreaDetail: Story = {
  name: "Area Detail",
  args: { page: cleanMinimalTradeAreaDetailPage },
};

export const Reviews: Story = {
  args: { page: cleanMinimalTradeReviewsPage },
};

export const Gallery: Story = {
  args: { page: cleanMinimalTradeGalleryPage },
};

export const FAQ: Story = {
  args: { page: cleanMinimalTradeFaqPage },
};

export const Contact: Story = {
  args: { page: cleanMinimalTradeContactPage },
};

export const BlogIndex: Story = {
  name: "Blog Index",
  args: { page: cleanMinimalTradeBlogIndexPage },
};

export const BlogPost: Story = {
  name: "Blog Post",
  args: { page: cleanMinimalTradeBlogPostPage },
};

export const PrivacyPolicy: Story = {
  name: "Privacy Policy",
  args: { page: cleanMinimalTradePrivacyPolicyPage },
};

export const CookiePolicy: Story = {
  name: "Cookie Policy",
  args: { page: cleanMinimalTradeCookiePolicyPage },
};

export const TermsConditions: Story = {
  name: "Terms Conditions",
  args: { page: cleanMinimalTradeTermsConditionsPage },
};

export const NotFound: Story = {
  name: "404",
  args: { page: cleanMinimalTradeNotFoundPage },
};
