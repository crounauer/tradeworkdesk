export type BlockCategory =
  | 'site'
  | 'hero'
  | 'trust'
  | 'services'
  | 'features'
  | 'about'
  | 'process'
  | 'reviews'
  | 'areas'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'gallery'
  | 'blog'
  | 'legal'
  | 'system';

export type BlockDefinition = {
  type: string;
  label: string;
  category: BlockCategory;
  editableFields: string[];
};

export const twdBlockRegistry = [
  {
    type: 'site.header',
    label: 'Site Header',
    category: 'site',
    editableFields: ['logoText', 'navItems', 'phone', 'ctaLabel', 'ctaHref', 'scheduleText', 'locationText', 'layout', 'headerStyle', 'tone', 'ctaStyle', 'variant'],
  },
  {
    type: 'hero.standard',
    label: 'Standard Hero',
    category: 'hero',
    editableFields: ['eyebrow', 'layout', 'variant', 'heroStyle', 'tone', 'density', 'title', 'subtitle', 'primaryCtaLabel', 'secondaryCtaLabel', 'phone', 'trustBadges', 'imageAlt'],
  },
  {
    type: 'trust.badges',
    label: 'Trust Badges',
    category: 'trust',
    editableFields: ['variant', 'background', 'cardStyle', 'density', 'badges'],
  },
  {
    type: 'services.grid',
    label: 'Services Grid',
    category: 'services',
    editableFields: ['eyebrow', 'variant', 'layout', 'background', 'cardStyle', 'density', 'title', 'subtitle', 'services'],
  },
  {
    type: 'services.rates',
    label: 'Service Rates',
    category: 'services',
    editableFields: ['eyebrow', 'variation', 'background', 'title', 'subtitle', 'note', 'rates'],
  },
  {
    type: 'features.list',
    label: 'Feature List',
    category: 'features',
    editableFields: ['eyebrow', 'title', 'subtitle', 'features'],
  },
  {
    type: 'about.intro',
    label: 'About Intro',
    category: 'about',
    editableFields: ['eyebrow', 'variant', 'background', 'tone', 'title', 'body', 'bullets'],
  },
  {
    type: 'process.steps',
    label: 'Process Steps',
    category: 'process',
    editableFields: ['eyebrow', 'variant', 'layout', 'tone', 'title', 'steps'],
  },
  {
    type: 'reviews.grid',
    label: 'Reviews Grid',
    category: 'reviews',
    editableFields: ['eyebrow', 'variant', 'cardStyle', 'background', 'title', 'reviews'],
  },
  {
    type: 'areas.grid',
    label: 'Areas Covered Grid',
    category: 'areas',
    editableFields: ['eyebrow', 'title', 'subtitle', 'areas'],
  },
  {
    type: 'faq.accordion',
    label: 'FAQ Accordion',
    category: 'faq',
    editableFields: ['eyebrow', 'title', 'faqs'],
  },
  {
    type: 'cta.banner',
    label: 'CTA Banner',
    category: 'cta',
    editableFields: ['ctaStyle', 'tone', 'background', 'title', 'subtitle', 'primaryCtaLabel', 'secondaryCtaLabel', 'phone'],
  },
  {
    type: 'contact.split',
    label: 'Contact Split',
    category: 'contact',
    editableFields: ['eyebrow', 'title', 'subtitle', 'phone', 'email', 'address', 'openingHours'],
  },
  {
    type: 'gallery.grid',
    label: 'Gallery Grid',
    category: 'gallery',
    editableFields: ['eyebrow', 'title', 'images'],
  },
  {
    type: 'blog.index',
    label: 'Blog Index',
    category: 'blog',
    editableFields: ['eyebrow', 'title', 'posts'],
  },
  {
    type: 'legal.content',
    label: 'Legal Content',
    category: 'legal',
    editableFields: ['title', 'updatedDate', 'sections'],
  },
  {
    type: 'system.notFound',
    label: '404 Not Found',
    category: 'system',
    editableFields: ['title', 'subtitle', 'ctaLabel', 'ctaHref'],
  },
  {
    type: 'site.footer',
    label: 'Site Footer',
    category: 'site',
    editableFields: ['logoText', 'description', 'phone', 'email', 'navItems', 'legalLinks', 'variant', 'layout', 'background', 'tone'],
  },
] as const satisfies readonly BlockDefinition[];

export type TwdBlockType = (typeof twdBlockRegistry)[number]['type'];
