import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function ensureDir(dir) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

function write(file, content) {
  const fullPath = path.join(root, file);
  ensureDir(path.dirname(file));
  fs.writeFileSync(fullPath, content.trimStart(), 'utf8');
  console.log(`wrote ${file}`);
}

function ensureStorybookPreview() {
  ensureDir('.storybook');
  const file = path.join(root, '.storybook/preview.ts');
  const previewContent = `import '../src/index.css';

import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
`;

  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').trim() === '') {
    fs.writeFileSync(file, previewContent, 'utf8');
    console.log('wrote .storybook/preview.ts');
    return;
  }

  const existing = fs.readFileSync(file, 'utf8');
  if (!existing.includes("../src/index.css") && !existing.includes("'../src/index.css'")) {
    fs.writeFileSync(file, `import '../src/index.css';\n\n${existing}`, 'utf8');
    console.log('updated .storybook/preview.ts');
  } else {
    console.log('kept .storybook/preview.ts');
  }
}

if (!fs.existsSync(path.join(root, 'package.json'))) {
  console.error('Run this from the business-app folder containing package.json.');
  process.exit(1);
}

ensureDir('src/twd/blocks');
ensureDir('src/twd/stories');
ensureDir('src/twd/templates');
ensureDir('src/twd/registry');
ensureDir('src/twd/fixtures');

ensureStorybookPreview();

write('src/twd/BLOCK_SYSTEM_RULES.md', `
# TWD Block System Rules

Blocks are reusable React TypeScript components for the TradeWorkDesk website builder.

Rules:
- Blocks live in src/twd/blocks.
- Stories live in src/twd/stories.
- Registry lives in src/twd/registry/blockRegistry.ts.
- Every block exports its Props type.
- Editable content must come from props.
- Do not hardcode business names inside components.
- Do not call APIs, Supabase, routing logic or database functions from blocks.
- Use Tailwind classes only.
- Do not use external UI libraries.
- Blocks must suit UK trade and local-service websites.
- Stories should use realistic UK plumbing/heating example content.
- Do not invent block types outside the registry.
- Any new block must have a story and a registry entry.
`);

write('src/twd/types.ts', `
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
`);

write('src/twd/blocks/SiteHeaderBlock.tsx', `
import type { NavItem } from '../types';

export type SiteHeaderBlockProps = {
  logoText: string;
  navItems: NavItem[];
  phone?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function SiteHeaderBlock({
  logoText,
  navItems,
  phone,
  ctaLabel,
  ctaHref = '#contact',
}: SiteHeaderBlockProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-6">
          <a href="/" className="text-xl font-bold tracking-tight text-slate-950">
            {logoText}
          </a>

          {phone ? (
            <a href={'tel:' + phone} className="text-sm font-semibold text-slate-700 lg:hidden">
              {phone}
            </a>
          ) : null}
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-700">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-slate-950">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {phone ? (
            <a href={'tel:' + phone} className="hidden text-sm font-semibold text-slate-700 lg:inline">
              {phone}
            </a>
          ) : null}

          {ctaLabel ? (
            <a href={ctaHref} className="rounded-md bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
`);

write('src/twd/blocks/HeroBlock.tsx', `
export type HeroBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  phone?: string;
  imageAlt?: string;
};

export function HeroBlock({
  eyebrow = 'Local trade specialists',
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  phone,
  imageAlt = 'Trade business image placeholder',
}: HeroBlockProps) {
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center lg:px-8">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-400">
            {eyebrow}
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {title}
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-200">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a href="#contact" className="rounded-md bg-amber-400 px-5 py-3 font-semibold text-slate-950">
              {primaryCtaLabel}
            </a>

            {secondaryCtaLabel ? (
              <a href="#services" className="rounded-md border border-white/30 px-5 py-3 font-semibold text-white">
                {secondaryCtaLabel}
              </a>
            ) : null}
          </div>

          {phone ? (
            <p className="mt-6 text-sm text-slate-300">
              Prefer to call? <span className="font-semibold text-white">{phone}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-slate-800 p-6 shadow-xl">
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-700 text-center text-sm text-slate-300">
            {imageAlt}
          </div>
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/TrustBadgesBlock.tsx', `
import type { BadgeItem } from '../types';

export type TrustBadgesBlockProps = {
  badges: BadgeItem[];
};

export function TrustBadgesBlock({ badges }: TrustBadgesBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-10 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
        {badges.map((badge) => (
          <div key={badge.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="font-bold text-slate-950">{badge.label}</p>
            <p className="mt-2 text-sm text-slate-600">{badge.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/ServicesGridBlock.tsx', `
import type { ServiceItem } from '../types';

export type ServicesGridBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  services: ServiceItem[];
};

export function ServicesGridBlock({
  eyebrow = 'Services',
  title,
  subtitle,
  services,
}: ServicesGridBlockProps) {
  return (
    <section id="services" className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-lg text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <article key={service.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-950">{service.title}</h3>
              <p className="mt-3 text-slate-600">{service.description}</p>
              {service.href ? (
                <a href={service.href} className="mt-5 inline-block font-semibold text-slate-950">
                  Learn more →
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/FeatureListBlock.tsx', `
import type { FeatureItem } from '../types';

export type FeatureListBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  features: FeatureItem[];
};

export function FeatureListBlock({
  eyebrow = 'Why choose us',
  title,
  subtitle,
  features,
}: FeatureListBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-4 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="grid gap-6 lg:col-span-2 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-950">{feature.title}</h3>
              <p className="mt-2 text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/AboutIntroBlock.tsx', `
export type AboutIntroBlockProps = {
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: string[];
};

export function AboutIntroBlock({
  eyebrow = 'About us',
  title,
  body,
  bullets = [],
}: AboutIntroBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
        </div>

        <div>
          <p className="text-lg leading-8 text-slate-600">{body}</p>

          {bullets.length > 0 ? (
            <ul className="mt-8 grid gap-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="rounded-lg bg-slate-50 px-4 py-3 font-medium text-slate-800">
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/ProcessStepsBlock.tsx', `
import type { ProcessStep } from '../types';

export type ProcessStepsBlockProps = {
  eyebrow?: string;
  title: string;
  steps: ProcessStep[];
};

export function ProcessStepsBlock({
  eyebrow = 'How it works',
  title,
  steps,
}: ProcessStepsBlockProps) {
  return (
    <section className="bg-slate-950 px-6 py-20 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">
                {index + 1}
              </div>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-slate-300">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/ReviewsBlock.tsx', `
import type { ReviewItem } from '../types';

export type ReviewsBlockProps = {
  eyebrow?: string;
  title: string;
  reviews: ReviewItem[];
};

export function ReviewsBlock({
  eyebrow = 'Reviews',
  title,
  reviews,
}: ReviewsBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {reviews.map((review) => (
            <figure key={review.name + review.quote} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              {review.rating ? (
                <p className="mb-4 text-sm font-bold text-amber-600">{review.rating}/5 rating</p>
              ) : null}
              <blockquote className="text-slate-700">“{review.quote}”</blockquote>
              <figcaption className="mt-5 font-semibold text-slate-950">
                {review.name}
                {review.location ? <span className="font-normal text-slate-500">, {review.location}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/AreasCoveredBlock.tsx', `
import type { AreaItem } from '../types';

export type AreasCoveredBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  areas: AreaItem[];
};

export function AreasCoveredBlock({
  eyebrow = 'Areas covered',
  title,
  subtitle,
  areas,
}: AreasCoveredBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((area) => {
            const content = (
              <span className="block rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800">
                {area.name}
              </span>
            );

            return area.href ? (
              <a key={area.name} href={area.href}>{content}</a>
            ) : (
              <div key={area.name}>{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/FaqBlock.tsx', `
import type { FaqItem } from '../types';

export type FaqBlockProps = {
  eyebrow?: string;
  title: string;
  faqs: FaqItem[];
};

export function FaqBlock({
  eyebrow = 'FAQ',
  title,
  faqs,
}: FaqBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {faqs.map((faq) => (
            <details key={faq.question} className="group p-6">
              <summary className="cursor-pointer list-none font-semibold text-slate-950">
                {faq.question}
              </summary>
              <p className="mt-3 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/CtaBannerBlock.tsx', `
export type CtaBannerBlockProps = {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  phone?: string;
};

export function CtaBannerBlock({
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  phone,
}: CtaBannerBlockProps) {
  return (
    <section className="bg-amber-400 px-6 py-16 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-3 max-w-2xl text-slate-800">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="#contact" className="rounded-md bg-slate-950 px-5 py-3 font-bold text-white">
            {primaryCtaLabel}
          </a>

          {secondaryCtaLabel && phone ? (
            <a href={'tel:' + phone} className="rounded-md border border-slate-950 px-5 py-3 font-bold text-slate-950">
              {secondaryCtaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/ContactBlock.tsx', `
export type ContactBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingHours?: string;
};

export function ContactBlock({
  eyebrow = 'Contact',
  title,
  subtitle,
  phone,
  email,
  address,
  openingHours,
}: ContactBlockProps) {
  return (
    <section id="contact" className="bg-slate-950 px-6 py-20 text-white lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-slate-300">{subtitle}</p> : null}

          <dl className="mt-8 grid gap-4 text-slate-200">
            {phone ? (
              <div>
                <dt className="font-semibold text-white">Phone</dt>
                <dd><a href={'tel:' + phone}>{phone}</a></dd>
              </div>
            ) : null}

            {email ? (
              <div>
                <dt className="font-semibold text-white">Email</dt>
                <dd><a href={'mailto:' + email}>{email}</a></dd>
              </div>
            ) : null}

            {address ? (
              <div>
                <dt className="font-semibold text-white">Address</dt>
                <dd>{address}</dd>
              </div>
            ) : null}

            {openingHours ? (
              <div>
                <dt className="font-semibold text-white">Opening hours</dt>
                <dd>{openingHours}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-6 text-slate-950">
          <p className="text-lg font-bold">Enquiry form placeholder</p>
          <p className="mt-2 text-slate-600">
            This block is ready for your website builder form fields later.
          </p>
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/GalleryBlock.tsx', `
import type { GalleryImageItem } from '../types';

export type GalleryBlockProps = {
  eyebrow?: string;
  title: string;
  images: GalleryImageItem[];
};

export function GalleryBlock({
  eyebrow = 'Gallery',
  title,
  images,
}: GalleryBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <figure key={image.alt + image.caption} className="rounded-xl bg-slate-100 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-slate-300 text-center text-sm text-slate-700">
                {image.alt}
              </div>
              {image.caption ? <figcaption className="mt-3 text-sm font-medium text-slate-700">{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/BlogIndexBlock.tsx', `
import type { BlogPostItem } from '../types';

export type BlogIndexBlockProps = {
  eyebrow?: string;
  title: string;
  posts: BlogPostItem[];
};

export function BlogIndexBlock({
  eyebrow = 'Blog',
  title,
  posts,
}: BlogIndexBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <article key={post.href} className="rounded-xl border border-slate-200 bg-white p-6">
              {post.date ? <p className="text-sm font-semibold text-amber-600">{post.date}</p> : null}
              <h3 className="mt-3 text-xl font-bold text-slate-950">{post.title}</h3>
              <p className="mt-3 text-slate-600">{post.excerpt}</p>
              <a href={post.href} className="mt-5 inline-block font-semibold text-slate-950">
                Read article →
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/LegalContentBlock.tsx', `
import type { LegalSection } from '../types';

export type LegalContentBlockProps = {
  title: string;
  updatedDate?: string;
  sections: LegalSection[];
};

export function LegalContentBlock({
  title,
  updatedDate,
  sections,
}: LegalContentBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950">{title}</h1>
        {updatedDate ? <p className="mt-3 text-sm text-slate-500">Last updated: {updatedDate}</p> : null}

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold text-slate-950">{section.heading}</h2>
              <p className="mt-3 leading-7 text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
`);

write('src/twd/blocks/NotFoundBlock.tsx', `
export type NotFoundBlockProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
};

export function NotFoundBlock({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: NotFoundBlockProps) {
  return (
    <section className="flex min-h-[70vh] items-center bg-slate-950 px-6 py-20 text-white lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">404</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-5 text-lg text-slate-300">{subtitle}</p>
        <a href={ctaHref} className="mt-8 inline-block rounded-md bg-amber-400 px-5 py-3 font-bold text-slate-950">
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
`);

write('src/twd/blocks/SiteFooterBlock.tsx', `
import type { NavItem, SimpleLink } from '../types';

export type SiteFooterBlockProps = {
  logoText: string;
  description?: string;
  phone?: string;
  email?: string;
  navItems: NavItem[];
  legalLinks: SimpleLink[];
};

export function SiteFooterBlock({
  logoText,
  description,
  phone,
  email,
  navItems,
  legalLinks,
}: SiteFooterBlockProps) {
  return (
    <footer className="bg-slate-950 px-6 py-12 text-white lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <div>
          <p className="text-xl font-bold">{logoText}</p>
          {description ? <p className="mt-3 text-sm text-slate-300">{description}</p> : null}
        </div>

        <div>
          <p className="font-semibold">Navigation</p>
          <nav className="mt-3 grid gap-2 text-sm text-slate-300">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        </div>

        <div>
          <p className="font-semibold">Contact</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            {phone ? <a href={'tel:' + phone}>{phone}</a> : null}
            {email ? <a href={'mailto:' + email}>{email}</a> : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
`);

write('src/twd/blocks/index.ts', `
export * from './SiteHeaderBlock';
export * from './HeroBlock';
export * from './TrustBadgesBlock';
export * from './ServicesGridBlock';
export * from './FeatureListBlock';
export * from './AboutIntroBlock';
export * from './ProcessStepsBlock';
export * from './ReviewsBlock';
export * from './AreasCoveredBlock';
export * from './FaqBlock';
export * from './CtaBannerBlock';
export * from './ContactBlock';
export * from './GalleryBlock';
export * from './BlogIndexBlock';
export * from './LegalContentBlock';
export * from './NotFoundBlock';
export * from './SiteFooterBlock';
`);

write('src/twd/registry/blockRegistry.ts', `
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
`);

write('src/twd/stories/SiteHeaderBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteHeaderBlock } from '../blocks/SiteHeaderBlock';

const meta = {
  title: 'TWD Blocks/Header',
  component: SiteHeaderBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteHeaderBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    logoText: 'North East Eco Heat',
    navItems: [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Areas', href: '/areas-covered' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Contact', href: '/contact' },
    ],
    phone: '01224 000000',
    ctaLabel: 'Book a visit',
    ctaHref: '#contact',
  },
};
`);

write('src/twd/stories/HeroBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroBlock } from '../blocks/HeroBlock';

const meta = {
  title: 'TWD Blocks/Hero',
  component: HeroBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HeroBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Plumbing & heating specialists',
    title: 'Reliable plumbing and heating services across Aberdeenshire',
    subtitle: 'Professional boiler servicing, breakdowns, installations and heating upgrades from a trusted local business.',
    primaryCtaLabel: 'Request a quote',
    secondaryCtaLabel: 'View services',
    phone: '01224 000000',
    imageAlt: 'Engineer working on a heating system',
  },
};
`);

write('src/twd/stories/TrustBadgesBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrustBadgesBlock } from '../blocks/TrustBadgesBlock';

const meta = {
  title: 'TWD Blocks/Trust Badges',
  component: TrustBadgesBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TrustBadgesBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    badges: [
      { label: 'Local business', description: 'Based in the North East and trusted by local homeowners.' },
      { label: 'Clear pricing', description: 'Straightforward advice before work begins.' },
      { label: 'Practical repairs', description: 'Focused on reliable fixes, not unnecessary upselling.' },
    ],
  },
};
`);

write('src/twd/stories/ServicesGridBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ServicesGridBlock } from '../blocks/ServicesGridBlock';

const meta = {
  title: 'TWD Blocks/Services Grid',
  component: ServicesGridBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ServicesGridBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Services',
    title: 'Plumbing and heating services',
    subtitle: 'Core services for homeowners, landlords and small commercial properties.',
    services: [
      { title: 'Oil boiler servicing', description: 'Annual servicing to keep your boiler running safely and efficiently.', href: '/services/oil-boiler-servicing' },
      { title: 'Boiler breakdowns', description: 'Fault finding and repairs when your heating stops working.', href: '/services/boiler-breakdowns' },
      { title: 'Heating upgrades', description: 'Replacement boilers, controls and system improvements.', href: '/services/heating-upgrades' },
    ],
  },
};
`);

write('src/twd/stories/FeatureListBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeatureListBlock } from '../blocks/FeatureListBlock';

const meta = {
  title: 'TWD Blocks/Features List',
  component: FeatureListBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FeatureListBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Why choose us',
    title: 'Straightforward service from start to finish',
    subtitle: 'A practical approach for customers who want clear answers and reliable workmanship.',
    features: [
      { title: 'Local knowledge', description: 'Experience with rural properties, oil heating and heating systems common across the area.' },
      { title: 'No nonsense advice', description: 'You get clear options without pressure or confusing sales talk.' },
      { title: 'Tidy workmanship', description: 'Work is carried out carefully with respect for your home.' },
      { title: 'Reliable communication', description: 'Customers are kept informed before, during and after the job.' },
    ],
  },
};
`);

write('src/twd/stories/AboutIntroBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AboutIntroBlock } from '../blocks/AboutIntroBlock';

const meta = {
  title: 'TWD Blocks/About Intro',
  component: AboutIntroBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AboutIntroBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'About us',
    title: 'A local trade business built on practical service',
    body: 'We help homeowners and landlords keep their heating and plumbing systems working properly with clear advice, careful workmanship and dependable support.',
    bullets: ['Oil boiler servicing and repairs', 'Heating upgrades and controls', 'Local service across Aberdeenshire'],
  },
};
`);

write('src/twd/stories/ProcessStepsBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProcessStepsBlock } from '../blocks/ProcessStepsBlock';

const meta = {
  title: 'TWD Blocks/Process Steps',
  component: ProcessStepsBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProcessStepsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'How it works',
    title: 'Simple process, clear communication',
    steps: [
      { title: 'Get in touch', description: 'Tell us what you need help with and where you are based.' },
      { title: 'Assessment', description: 'We inspect the issue or discuss the work required.' },
      { title: 'Repair or quote', description: 'You receive practical advice and a clear next step.' },
    ],
  },
};
`);

write('src/twd/stories/ReviewsBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReviewsBlock } from '../blocks/ReviewsBlock';

const meta = {
  title: 'TWD Blocks/Reviews',
  component: ReviewsBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReviewsBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Reviews',
    title: 'What customers say',
    reviews: [
      { quote: 'Arrived when agreed, explained the issue clearly and got the boiler running again.', name: 'Customer', location: 'Ellon', rating: 5 },
      { quote: 'Professional service and tidy work. Would happily use again.', name: 'Customer', location: 'Inverurie', rating: 5 },
      { quote: 'Helpful advice and a straightforward repair without any fuss.', name: 'Customer', location: 'Peterhead', rating: 5 },
    ],
  },
};
`);

write('src/twd/stories/AreasCoveredBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AreasCoveredBlock } from '../blocks/AreasCoveredBlock';

const meta = {
  title: 'TWD Blocks/Areas Covered',
  component: AreasCoveredBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AreasCoveredBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Areas covered',
    title: 'Serving homes across the North East',
    subtitle: 'Local plumbing and heating support across towns and rural areas.',
    areas: [
      { name: 'Ellon', href: '/areas/ellon' },
      { name: 'Inverurie', href: '/areas/inverurie' },
      { name: 'Peterhead', href: '/areas/peterhead' },
      { name: 'Aberdeen', href: '/areas/aberdeen' },
      { name: 'Oldmeldrum', href: '/areas/oldmeldrum' },
      { name: 'Mintlaw', href: '/areas/mintlaw' },
      { name: 'Newburgh', href: '/areas/newburgh' },
      { name: 'Balmedie', href: '/areas/balmedie' },
    ],
  },
};
`);

write('src/twd/stories/FaqBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaqBlock } from '../blocks/FaqBlock';

const meta = {
  title: 'TWD Blocks/FAQ',
  component: FaqBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FaqBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'FAQ',
    title: 'Common questions',
    faqs: [
      { question: 'Do you service oil boilers?', answer: 'Yes, this template supports oil boiler servicing content and can be adapted for other heating services.' },
      { question: 'Can customers request a quote online?', answer: 'Yes, this block structure can be connected to your future TWD enquiry form.' },
      { question: 'Can the areas be edited?', answer: 'Yes, areas are passed in as editable data and can be mapped to CMS fields later.' },
    ],
  },
};
`);

write('src/twd/stories/CtaBannerBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CtaBannerBlock } from '../blocks/CtaBannerBlock';

const meta = {
  title: 'TWD Blocks/CTA Banner',
  component: CtaBannerBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CtaBannerBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    title: 'Need help with your heating?',
    subtitle: 'Get practical advice and a clear next step from a local trade business.',
    primaryCtaLabel: 'Request a quote',
    secondaryCtaLabel: 'Call now',
    phone: '01224 000000',
  },
};
`);

write('src/twd/stories/ContactBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContactBlock } from '../blocks/ContactBlock';

const meta = {
  title: 'TWD Blocks/Contact',
  component: ContactBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ContactBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Contact',
    title: 'Request a quote or ask a question',
    subtitle: 'Tell us what you need help with and we will get back to you.',
    phone: '01224 000000',
    email: 'hello@example.co.uk',
    address: 'Aberdeenshire, Scotland',
    openingHours: 'Monday to Friday, 8am to 5pm',
  },
};
`);

write('src/twd/stories/GalleryBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GalleryBlock } from '../blocks/GalleryBlock';

const meta = {
  title: 'TWD Blocks/Gallery',
  component: GalleryBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GalleryBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Gallery',
    title: 'Recent work',
    images: [
      { alt: 'Boiler installation photo placeholder', caption: 'Replacement boiler installation' },
      { alt: 'Heating controls photo placeholder', caption: 'Heating controls upgrade' },
      { alt: 'Plant room photo placeholder', caption: 'Heating system maintenance' },
    ],
  },
};
`);

write('src/twd/stories/BlogIndexBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BlogIndexBlock } from '../blocks/BlogIndexBlock';

const meta = {
  title: 'TWD Blocks/Blog Index',
  component: BlogIndexBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BlogIndexBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    eyebrow: 'Advice',
    title: 'Latest heating advice',
    posts: [
      { title: 'How often should an oil boiler be serviced?', excerpt: 'A simple guide for homeowners who want to keep their boiler safe and efficient.', href: '/blog/oil-boiler-service', date: '12 June 2026' },
      { title: 'Signs your heating system needs attention', excerpt: 'Common warning signs that should not be ignored.', href: '/blog/heating-warning-signs', date: '18 June 2026' },
      { title: 'Choosing better heating controls', excerpt: 'How modern controls can improve comfort and reduce wasted energy.', href: '/blog/heating-controls', date: '24 June 2026' },
    ],
  },
};
`);

write('src/twd/stories/LegalContentBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegalContentBlock } from '../blocks/LegalContentBlock';

const meta = {
  title: 'TWD Blocks/Legal Content',
  component: LegalContentBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LegalContentBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrivacyPolicy: Story = {
  args: {
    title: 'Privacy Policy',
    updatedDate: '24 June 2026',
    sections: [
      { heading: 'Who we are', body: 'This section explains who operates the website and how visitors can make contact.' },
      { heading: 'Information we collect', body: 'This section explains what information may be collected when a visitor submits an enquiry.' },
      { heading: 'How information is used', body: 'This section explains how enquiry information is used to respond to customers.' },
    ],
  },
};
`);

write('src/twd/stories/NotFoundBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotFoundBlock } from '../blocks/NotFoundBlock';

const meta = {
  title: 'TWD Blocks/404',
  component: NotFoundBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NotFoundBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Page not found',
    subtitle: 'The page you are looking for may have moved or no longer exists.',
    ctaLabel: 'Return home',
    ctaHref: '/',
  },
};
`);

write('src/twd/stories/SiteFooterBlock.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteFooterBlock } from '../blocks/SiteFooterBlock';

const meta = {
  title: 'TWD Blocks/Footer',
  component: SiteFooterBlock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteFooterBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlumbingHeating: Story = {
  args: {
    logoText: 'North East Eco Heat',
    description: 'Local plumbing and heating support for homeowners and landlords.',
    phone: '01224 000000',
    email: 'hello@example.co.uk',
    navItems: [
      { label: 'Services', href: '/services' },
      { label: 'Areas', href: '/areas-covered' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Contact', href: '/contact' },
    ],
    legalLinks: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Cookie Policy', href: '/cookie-policy' },
      { label: 'Terms', href: '/terms-conditions' },
    ],
  },
};
`);

write('src/twd/templates/TemplatePageRenderer.tsx', `
import {
  AboutIntroBlock,
  AreasCoveredBlock,
  BlogIndexBlock,
  ContactBlock,
  CtaBannerBlock,
  FaqBlock,
  FeatureListBlock,
  GalleryBlock,
  HeroBlock,
  LegalContentBlock,
  NotFoundBlock,
  ProcessStepsBlock,
  ReviewsBlock,
  ServicesGridBlock,
  SiteFooterBlock,
  SiteHeaderBlock,
  TrustBadgesBlock,
  type AboutIntroBlockProps,
  type AreasCoveredBlockProps,
  type BlogIndexBlockProps,
  type ContactBlockProps,
  type CtaBannerBlockProps,
  type FaqBlockProps,
  type FeatureListBlockProps,
  type GalleryBlockProps,
  type HeroBlockProps,
  type LegalContentBlockProps,
  type NotFoundBlockProps,
  type ProcessStepsBlockProps,
  type ReviewsBlockProps,
  type ServicesGridBlockProps,
  type SiteFooterBlockProps,
  type SiteHeaderBlockProps,
  type TrustBadgesBlockProps,
} from '../blocks';
import type { TwdBlockType } from '../registry/blockRegistry';

export type TemplatePageBlock = {
  type: TwdBlockType;
  props: Record<string, unknown>;
};

export type TemplatePage = {
  title: string;
  blocks: TemplatePageBlock[];
};

export function TemplatePageRenderer({ page }: { page: TemplatePage }) {
  return (
    <main>
      {page.blocks.map((block, index) => {
        switch (block.type) {
          case 'site.header':
            return <SiteHeaderBlock key={index} {...(block.props as SiteHeaderBlockProps)} />;
          case 'hero.standard':
            return <HeroBlock key={index} {...(block.props as HeroBlockProps)} />;
          case 'trust.badges':
            return <TrustBadgesBlock key={index} {...(block.props as TrustBadgesBlockProps)} />;
          case 'services.grid':
            return <ServicesGridBlock key={index} {...(block.props as ServicesGridBlockProps)} />;
          case 'features.list':
            return <FeatureListBlock key={index} {...(block.props as FeatureListBlockProps)} />;
          case 'about.intro':
            return <AboutIntroBlock key={index} {...(block.props as AboutIntroBlockProps)} />;
          case 'process.steps':
            return <ProcessStepsBlock key={index} {...(block.props as ProcessStepsBlockProps)} />;
          case 'reviews.grid':
            return <ReviewsBlock key={index} {...(block.props as ReviewsBlockProps)} />;
          case 'areas.grid':
            return <AreasCoveredBlock key={index} {...(block.props as AreasCoveredBlockProps)} />;
          case 'faq.accordion':
            return <FaqBlock key={index} {...(block.props as FaqBlockProps)} />;
          case 'cta.banner':
            return <CtaBannerBlock key={index} {...(block.props as CtaBannerBlockProps)} />;
          case 'contact.split':
            return <ContactBlock key={index} {...(block.props as ContactBlockProps)} />;
          case 'gallery.grid':
            return <GalleryBlock key={index} {...(block.props as GalleryBlockProps)} />;
          case 'blog.index':
            return <BlogIndexBlock key={index} {...(block.props as BlogIndexBlockProps)} />;
          case 'legal.content':
            return <LegalContentBlock key={index} {...(block.props as LegalContentBlockProps)} />;
          case 'system.notFound':
            return <NotFoundBlock key={index} {...(block.props as NotFoundBlockProps)} />;
          case 'site.footer':
            return <SiteFooterBlock key={index} {...(block.props as SiteFooterBlockProps)} />;
          default:
            return null;
        }
      })}
    </main>
  );
}
`);

write('src/twd/templates/modernTradeHome.recipe.ts', `
import type { TemplatePage } from './TemplatePageRenderer';

export const modernTradeHomePage: TemplatePage = {
  title: 'Home',
  blocks: [
    {
      type: 'site.header',
      props: {
        logoText: 'North East Eco Heat',
        navItems: [
          { label: 'Home', href: '/' },
          { label: 'Services', href: '/services' },
          { label: 'Areas', href: '/areas-covered' },
          { label: 'Reviews', href: '/reviews' },
          { label: 'Contact', href: '/contact' },
        ],
        phone: '01224 000000',
        ctaLabel: 'Book a visit',
        ctaHref: '#contact',
      },
    },
    {
      type: 'hero.standard',
      props: {
        eyebrow: 'Plumbing & heating specialists',
        title: 'Reliable plumbing and heating services across Aberdeenshire',
        subtitle: 'Professional boiler servicing, breakdowns, installations and heating upgrades from a trusted local business.',
        primaryCtaLabel: 'Request a quote',
        secondaryCtaLabel: 'View services',
        phone: '01224 000000',
        imageAlt: 'Engineer working on a heating system',
      },
    },
    {
      type: 'trust.badges',
      props: {
        badges: [
          { label: 'Local business', description: 'Based in the North East and trusted by local homeowners.' },
          { label: 'Clear pricing', description: 'Straightforward advice before work begins.' },
          { label: 'Practical repairs', description: 'Focused on reliable fixes, not unnecessary upselling.' },
        ],
      },
    },
    {
      type: 'services.grid',
      props: {
        eyebrow: 'Services',
        title: 'How we can help',
        subtitle: 'Core services for homeowners, landlords and small commercial properties.',
        services: [
          { title: 'Oil boiler servicing', description: 'Annual servicing to keep your boiler running safely and efficiently.', href: '/services/oil-boiler-servicing' },
          { title: 'Boiler breakdowns', description: 'Fault finding and repairs when your heating stops working.', href: '/services/boiler-breakdowns' },
          { title: 'Heating upgrades', description: 'Replacement boilers, controls and system improvements.', href: '/services/heating-upgrades' },
        ],
      },
    },
    {
      type: 'reviews.grid',
      props: {
        eyebrow: 'Reviews',
        title: 'What customers say',
        reviews: [
          { quote: 'Arrived when agreed, explained the issue clearly and got the boiler running again.', name: 'Customer', location: 'Ellon', rating: 5 },
          { quote: 'Professional service and tidy work. Would happily use again.', name: 'Customer', location: 'Inverurie', rating: 5 },
          { quote: 'Helpful advice and a straightforward repair without any fuss.', name: 'Customer', location: 'Peterhead', rating: 5 },
        ],
      },
    },
    {
      type: 'areas.grid',
      props: {
        eyebrow: 'Areas covered',
        title: 'Serving homes across the North East',
        subtitle: 'Local plumbing and heating support across towns and rural areas.',
        areas: [
          { name: 'Ellon', href: '/areas/ellon' },
          { name: 'Inverurie', href: '/areas/inverurie' },
          { name: 'Peterhead', href: '/areas/peterhead' },
          { name: 'Aberdeen', href: '/areas/aberdeen' },
        ],
      },
    },
    {
      type: 'faq.accordion',
      props: {
        eyebrow: 'FAQ',
        title: 'Common questions',
        faqs: [
          { question: 'Do you service oil boilers?', answer: 'Yes, this template supports oil boiler servicing content and can be adapted for other heating services.' },
          { question: 'Can customers request a quote online?', answer: 'Yes, this block structure can be connected to your future TWD enquiry form.' },
          { question: 'Can the areas be edited?', answer: 'Yes, areas are passed in as editable data and can be mapped to CMS fields later.' },
        ],
      },
    },
    {
      type: 'cta.banner',
      props: {
        title: 'Need help with your heating?',
        subtitle: 'Get practical advice and a clear next step from a local trade business.',
        primaryCtaLabel: 'Request a quote',
        secondaryCtaLabel: 'Call now',
        phone: '01224 000000',
      },
    },
    {
      type: 'contact.split',
      props: {
        eyebrow: 'Contact',
        title: 'Request a quote or ask a question',
        subtitle: 'Tell us what you need help with and we will get back to you.',
        phone: '01224 000000',
        email: 'hello@example.co.uk',
        address: 'Aberdeenshire, Scotland',
        openingHours: 'Monday to Friday, 8am to 5pm',
      },
    },
    {
      type: 'site.footer',
      props: {
        logoText: 'North East Eco Heat',
        description: 'Local plumbing and heating support for homeowners and landlords.',
        phone: '01224 000000',
        email: 'hello@example.co.uk',
        navItems: [
          { label: 'Services', href: '/services' },
          { label: 'Areas', href: '/areas-covered' },
          { label: 'Reviews', href: '/reviews' },
          { label: 'Contact', href: '/contact' },
        ],
        legalLinks: [
          { label: 'Privacy Policy', href: '/privacy-policy' },
          { label: 'Cookie Policy', href: '/cookie-policy' },
          { label: 'Terms', href: '/terms-conditions' },
        ],
      },
    },
  ],
};
`);

write('src/twd/stories/ModernTradeHomePage.stories.tsx', `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TemplatePageRenderer } from '../templates/TemplatePageRenderer';
import { modernTradeHomePage } from '../templates/modernTradeHome.recipe';

const meta = {
  title: 'TWD Templates/Modern Trade/Home Page',
  component: TemplatePageRenderer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TemplatePageRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HomePage: Story = {
  args: {
    page: modernTradeHomePage,
  },
};
`);

console.log('');
console.log('TWD block library generated.');
console.log('');
console.log('Next commands:');
console.log('  pnpm storybook');
console.log('  git status');
