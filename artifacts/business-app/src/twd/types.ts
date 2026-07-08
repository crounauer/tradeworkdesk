export type NavItem = {
  label: string;
  href: string;
};

export type SimpleLink = {
  label: string;
  href: string;
};

export type BadgeItem = {
  label: string;
  description: string;
};

export type ServiceItem = {
  title: string;
  description: string;
  href?: string;
};

export type ServiceRateItem = {
  service: string;
  price: string;
  description?: string;
  duration?: string;
  badge?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type FeatureItem = {
  title: string;
  description: string;
};

export type ProcessStep = {
  title: string;
  description: string;
};

export type ReviewItem = {
  quote: string;
  name: string;
  location?: string;
  rating?: number;
};

export type AreaItem = {
  name: string;
  href?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type GalleryImageItem = {
  alt: string;
  caption?: string;
};

export type BlogPostItem = {
  title: string;
  excerpt: string;
  href: string;
  date?: string;
};

export type LegalSection = {
  heading: string;
  body: string;
};

export type ContactDetails = {
  phone?: string;
  email?: string;
  address?: string;
  openingHours?: string;
};
