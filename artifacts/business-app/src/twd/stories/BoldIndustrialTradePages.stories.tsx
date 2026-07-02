import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import {
  boldIndustrialTradeAboutPage,
  boldIndustrialTradeAreaDetailPage,
  boldIndustrialTradeAreasCoveredPage,
  boldIndustrialTradeBlogIndexPage,
  boldIndustrialTradeBlogPostPage,
  boldIndustrialTradeContactPage,
  boldIndustrialTradeCookiePolicyPage,
  boldIndustrialTradeFaqPage,
  boldIndustrialTradeGalleryPage,
  boldIndustrialTradeHomePage,
  boldIndustrialTradeNotFoundPage,
  boldIndustrialTradePrivacyPolicyPage,
  boldIndustrialTradeReviewsPage,
  boldIndustrialTradeServiceDetailPage,
  boldIndustrialTradeServicesPage,
  boldIndustrialTradeTermsConditionsPage,
} from "../templates/boldIndustrialTrade.pages";

const meta = {
  title: "TWD Templates/Bold Industrial Trade Pages",
  component: TemplatePageRenderer,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { page: boldIndustrialTradeHomePage },
};

export const About: Story = {
  args: { page: boldIndustrialTradeAboutPage },
};

export const Services: Story = {
  args: { page: boldIndustrialTradeServicesPage },
};

export const ServiceDetail: Story = {
  name: "Service Detail",
  args: { page: boldIndustrialTradeServiceDetailPage },
};

export const AreasCovered: Story = {
  name: "Areas Covered",
  args: { page: boldIndustrialTradeAreasCoveredPage },
};

export const AreaDetail: Story = {
  name: "Area Detail",
  args: { page: boldIndustrialTradeAreaDetailPage },
};

export const Reviews: Story = {
  args: { page: boldIndustrialTradeReviewsPage },
};

export const Gallery: Story = {
  args: { page: boldIndustrialTradeGalleryPage },
};

export const FAQ: Story = {
  args: { page: boldIndustrialTradeFaqPage },
};

export const Contact: Story = {
  args: { page: boldIndustrialTradeContactPage },
};

export const BlogIndex: Story = {
  name: "Blog Index",
  args: { page: boldIndustrialTradeBlogIndexPage },
};

export const BlogPost: Story = {
  name: "Blog Post",
  args: { page: boldIndustrialTradeBlogPostPage },
};

export const PrivacyPolicy: Story = {
  name: "Privacy Policy",
  args: { page: boldIndustrialTradePrivacyPolicyPage },
};

export const CookiePolicy: Story = {
  name: "Cookie Policy",
  args: { page: boldIndustrialTradeCookiePolicyPage },
};

export const TermsConditions: Story = {
  name: "Terms Conditions",
  args: { page: boldIndustrialTradeTermsConditionsPage },
};

export const NotFound: Story = {
  name: "404",
  args: { page: boldIndustrialTradeNotFoundPage },
};
