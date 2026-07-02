import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import {
  professionalTradeAboutPage,
  professionalTradeAreaDetailPage,
  professionalTradeAreasCoveredPage,
  professionalTradeBlogIndexPage,
  professionalTradeBlogPostPage,
  professionalTradeContactPage,
  professionalTradeCookiePolicyPage,
  professionalTradeFaqPage,
  professionalTradeGalleryPage,
  professionalTradeHomePage,
  professionalTradeNotFoundPage,
  professionalTradePrivacyPolicyPage,
  professionalTradeReviewsPage,
  professionalTradeServiceDetailPage,
  professionalTradeServicesPage,
  professionalTradeTermsConditionsPage,
} from "../templates/professionalTrade.pages";

const meta = {
  title: "TWD Templates/Professional Trade Pages",
  component: TemplatePageRenderer,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { page: professionalTradeHomePage },
};

export const About: Story = {
  args: { page: professionalTradeAboutPage },
};

export const Services: Story = {
  args: { page: professionalTradeServicesPage },
};

export const ServiceDetail: Story = {
  name: "Service Detail",
  args: { page: professionalTradeServiceDetailPage },
};

export const AreasCovered: Story = {
  name: "Areas Covered",
  args: { page: professionalTradeAreasCoveredPage },
};

export const AreaDetail: Story = {
  name: "Area Detail",
  args: { page: professionalTradeAreaDetailPage },
};

export const Reviews: Story = {
  args: { page: professionalTradeReviewsPage },
};

export const Gallery: Story = {
  args: { page: professionalTradeGalleryPage },
};

export const FAQ: Story = {
  args: { page: professionalTradeFaqPage },
};

export const Contact: Story = {
  args: { page: professionalTradeContactPage },
};

export const BlogIndex: Story = {
  name: "Blog Index",
  args: { page: professionalTradeBlogIndexPage },
};

export const BlogPost: Story = {
  name: "Blog Post",
  args: { page: professionalTradeBlogPostPage },
};

export const PrivacyPolicy: Story = {
  name: "Privacy Policy",
  args: { page: professionalTradePrivacyPolicyPage },
};

export const CookiePolicy: Story = {
  name: "Cookie Policy",
  args: { page: professionalTradeCookiePolicyPage },
};

export const TermsConditions: Story = {
  name: "Terms Conditions",
  args: { page: professionalTradeTermsConditionsPage },
};

export const NotFound: Story = {
  name: "404",
  args: { page: professionalTradeNotFoundPage },
};
