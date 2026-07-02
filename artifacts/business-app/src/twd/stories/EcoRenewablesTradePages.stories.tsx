import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplatePageRenderer } from "../templates/TemplatePageRenderer";
import {
  ecoRenewablesTradeAboutPage,
  ecoRenewablesTradeAreaDetailPage,
  ecoRenewablesTradeAreasCoveredPage,
  ecoRenewablesTradeBlogIndexPage,
  ecoRenewablesTradeBlogPostPage,
  ecoRenewablesTradeContactPage,
  ecoRenewablesTradeCookiePolicyPage,
  ecoRenewablesTradeFaqPage,
  ecoRenewablesTradeGalleryPage,
  ecoRenewablesTradeHomePage,
  ecoRenewablesTradeNotFoundPage,
  ecoRenewablesTradePrivacyPolicyPage,
  ecoRenewablesTradeReviewsPage,
  ecoRenewablesTradeServiceDetailPage,
  ecoRenewablesTradeServicesPage,
  ecoRenewablesTradeTermsConditionsPage,
} from "../templates/ecoRenewablesTrade.pages";

const meta = {
  title: "TWD Templates / Eco Renewables Trade Pages",
  component: TemplatePageRenderer,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Home: Story = {
  args: { page: ecoRenewablesTradeHomePage },
};

export const About: Story = {
  args: { page: ecoRenewablesTradeAboutPage },
};

export const Services: Story = {
  args: { page: ecoRenewablesTradeServicesPage },
};

export const ServiceDetail: Story = {
  name: "Service Detail",
  args: { page: ecoRenewablesTradeServiceDetailPage },
};

export const AreasCovered: Story = {
  name: "Areas Covered",
  args: { page: ecoRenewablesTradeAreasCoveredPage },
};

export const AreaDetail: Story = {
  name: "Area Detail",
  args: { page: ecoRenewablesTradeAreaDetailPage },
};

export const Reviews: Story = {
  args: { page: ecoRenewablesTradeReviewsPage },
};

export const Gallery: Story = {
  args: { page: ecoRenewablesTradeGalleryPage },
};

export const FAQ: Story = {
  args: { page: ecoRenewablesTradeFaqPage },
};

export const Contact: Story = {
  args: { page: ecoRenewablesTradeContactPage },
};

export const BlogIndex: Story = {
  name: "Blog Index",
  args: { page: ecoRenewablesTradeBlogIndexPage },
};

export const BlogPost: Story = {
  name: "Blog Post",
  args: { page: ecoRenewablesTradeBlogPostPage },
};

export const PrivacyPolicy: Story = {
  name: "Privacy Policy",
  args: { page: ecoRenewablesTradePrivacyPolicyPage },
};

export const CookiePolicy: Story = {
  name: "Cookie Policy",
  args: { page: ecoRenewablesTradeCookiePolicyPage },
};

export const TermsConditions: Story = {
  name: "Terms Conditions",
  args: { page: ecoRenewablesTradeTermsConditionsPage },
};

export const NotFound: Story = {
  name: "404",
  args: { page: ecoRenewablesTradeNotFoundPage },
};
