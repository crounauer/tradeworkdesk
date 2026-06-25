export type WebsiteBlockType =
  | "business_info"
  | "hero"
  | "benefits"
  | "services"
  | "process"
  | "featured_project"
  | "trust_bar"
  | "reviews"
  | "areas"
  | "faq"
  | "contact";

export interface BusinessContent {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  accreditations: string[];
}

export interface HeroContent {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  secondaryButtonText: string;
  secondaryButtonUrl: string;
  imageUrl: string;
  imageAlt: string;
}

export interface BenefitsContent {
  heading: string;
  items: Array<{ title: string; description: string; icon: string }>;
}

export interface ServicesContent {
  heading: string;
  intro: string;
  items: Array<{
    title: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    slug: string;
    features: string[];
  }>;
}

export interface ProcessContent {
  heading: string;
  steps: Array<{ title: string; description: string }>;
}

export interface ReviewsContent {
  heading: string;
  items: Array<{
    customerName: string;
    location: string;
    rating: number;
    quote: string;
    service: string;
  }>;
}

export interface AreasContent {
  heading: string;
  intro: string;
  items: Array<{ name: string; slug: string }>;
}

export interface FaqsContent {
  heading: string;
  items: Array<{ question: string; answer: string }>;
}

export interface ContactContent {
  heading: string;
  intro: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  emergencyText: string;
  formEnabled: boolean;
}

export interface TenantWebsiteContent {
  business: BusinessContent;
  hero: HeroContent;
  benefits: BenefitsContent;
  services: ServicesContent;
  process: ProcessContent;
  reviews: ReviewsContent;
  areas: AreasContent;
  faqs: FaqsContent;
  contact: ContactContent;
}

export interface WebsiteTemplateBlock {
  id: string;
  type: WebsiteBlockType;
  name: string;
  description: string;
}

export interface WebsiteTemplatePage {
  slug: string;
  name: string;
  blocks: WebsiteTemplateBlock[];
}

export interface WebsiteTemplate {
  id: string;
  name: string;
  pages: WebsiteTemplatePage[];
}

export interface WebsiteTheme {
  name: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
    card: string;
    border: string;
    foreground: string;
    mutedForeground: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export interface ParsedHomeBlocks {
  pageName: string;
  componentNames: string[];
  blockTypes: WebsiteBlockType[];
}
