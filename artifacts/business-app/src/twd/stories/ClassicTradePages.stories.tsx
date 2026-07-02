import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import {
  classicTradeAboutPage,
  classicTradeAreaDetailPage,
  classicTradeAreasCoveredPage,
  classicTradeBlogIndexPage,
  classicTradeBlogPostPage,
  classicTradeContactPage,
  classicTradeCookiePolicyPage,
  classicTradeFaqPage,
  classicTradeGalleryPage,
  classicTradeHomePage,
  classicTradeNotFoundPage,
  classicTradePrivacyPolicyPage,
  classicTradeReviewsPage,
  classicTradeServiceDetailPage,
  classicTradeServicesPage,
  classicTradeTermsConditionsPage,
} from "../templates/classicTrade.pages";

const meta = {
  title: "TWD Templates/Classic Trade Pages",
  component: TemplatePageRenderer,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { page: classicTradeHomePage },
};

export const About: Story = {
  args: { page: classicTradeAboutPage },
};

export const Services: Story = {
  args: { page: classicTradeServicesPage },
};

export const ServiceDetail: Story = {
  name: "Service Detail",
  args: { page: classicTradeServiceDetailPage },
};

export const AreasCovered: Story = {
  name: "Areas Covered",
  args: { page: classicTradeAreasCoveredPage },
};

export const AreaDetail: Story = {
  name: "Area Detail",
  args: { page: classicTradeAreaDetailPage },
};

export const Reviews: Story = {
  args: { page: classicTradeReviewsPage },
};

export const Gallery: Story = {
  args: { page: classicTradeGalleryPage },
};

export const FAQ: Story = {
  args: { page: classicTradeFaqPage },
};

export const Contact: Story = {
  args: { page: classicTradeContactPage },
};

export const BlogIndex: Story = {
  name: "Blog Index",
  args: { page: classicTradeBlogIndexPage },
};

export const BlogPost: Story = {
  name: "Blog Post",
  args: { page: classicTradeBlogPostPage },
};

export const PrivacyPolicy: Story = {
  name: "Privacy Policy",
  args: { page: classicTradePrivacyPolicyPage },
};

export const CookiePolicy: Story = {
  name: "Cookie Policy",
  args: { page: classicTradeCookiePolicyPage },
};

export const TermsConditions: Story = {
  name: "Terms Conditions",
  args: { page: classicTradeTermsConditionsPage },
};

export const NotFound: Story = {
  name: "404",
  args: { page: classicTradeNotFoundPage },
};