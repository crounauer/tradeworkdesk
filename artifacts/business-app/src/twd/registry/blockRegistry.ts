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
    editableFields: ['logoText', 'navItems', 'phone', 'ctaLabel', 'ctaHref'],
  },
  {
    type: 'hero.standard',
    label: 'Standard Hero',
    category: 'hero',
    editableFields: ['eyebrow', 'title', 'subtitle', 'primaryCtaLabel', 'secondaryCtaLabel', 'phone', 'imageAlt'],
  },
  {
    type: 'trust.badges',
    label: 'Trust Badges',
    category: 'trust',
    editableFields: ['badges'],
  },
  {
    type: 'services.grid',
    label: 'Services Grid',
    category: 'services',
    editableFields: ['eyebrow', 'title', 'subtitle', 'services'],
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
    editableFields: ['eyebrow', 'title', 'body', 'bullets'],
  },
  {
    type: 'process.steps',
    label: 'Process Steps',
    category: 'process',
    editableFields: ['eyebrow', 'title', 'steps'],
  },
  {
    type: 'reviews.grid',
    label: 'Reviews Grid',
    category: 'reviews',
    editableFields: ['eyebrow', 'title', 'reviews'],
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
    editableFields: ['title', 'subtitle', 'primaryCtaLabel', 'secondaryCtaLabel', 'phone'],
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
    editableFields: ['logoText', 'description', 'phone', 'email', 'navItems', 'legalLinks'],
  },
] as const satisfies readonly BlockDefinition[];

export type TwdBlockType = (typeof twdBlockRegistry)[number]['type'];
