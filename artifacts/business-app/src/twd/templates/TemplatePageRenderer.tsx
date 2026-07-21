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
  ServiceRatesBlock,
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
  type ServiceRatesBlockProps,
  type ServicesGridBlockProps,
  type SiteFooterBlockProps,
  type SiteHeaderBlockProps,
  type TrustBadgesBlockProps,
} from '../blocks';
import type { TwdBlockType } from '../registry/blockRegistry';
import { toStorybookBlockType } from './blockTypeParity';

export type TemplatePageBlock = {
  type?: TwdBlockType | string;
  block_type?: string;
  props?: Record<string, unknown>;
  content?: Record<string, unknown>;
};

export type TemplatePage = {
  title: string;
  blocks: TemplatePageBlock[];
};

const BACKGROUND_KEYS = [
  'background_color',
  'backgroundColor',
  'section_bg',
  'card_bg',
  'frame_bg',
  'background',
  'card_background_color',
  'outer_background',
  'muted_background_color',
  'primary_button_bg_color',
  'secondary_button_bg_color',
  'badge_bg_color',
  'primary_color',
  'secondary_color',
];

function readPrimaryBackground(props: Record<string, unknown>): string | null {
  for (const key of BACKGROUND_KEYS) {
    const value = props[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function resolveBackgroundInherit(
  value: string,
  previousBackground: string | null,
  backgroundByType: Record<string, string>
): string {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('inherit')) return value;

  const parts = trimmed.split(':');
  const target = String(parts[1] || 'previous').trim().toLowerCase();
  if (!target || target === 'previous') {
    return previousBackground || value;
  }

  return backgroundByType[target] || previousBackground || value;
}

function resolveBlockPropsWithBackgroundInheritance(
  blockType: string,
  props: Record<string, unknown>,
  previousBackground: string | null,
  backgroundByType: Record<string, string>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...props };

  for (const [key, rawValue] of Object.entries(next)) {
    const isBackgroundLike = key.includes('background') || key.endsWith('_bg') || key === 'primary_color' || key === 'secondary_color';
    if (!isBackgroundLike || typeof rawValue !== 'string') continue;

    next[key] = resolveBackgroundInherit(rawValue, previousBackground, backgroundByType);
  }

  const primary = readPrimaryBackground(next);
  if (primary) {
    backgroundByType[blockType.toLowerCase()] = primary;
    const shortType = blockType.split('.').pop()?.toLowerCase();
    if (shortType) {
      backgroundByType[shortType] = primary;
    }
  }

  return next;
}

export function TemplatePageRenderer({ page }: { page: TemplatePage }) {
  const backgroundByType: Record<string, string> = {};
  let previousBackground: string | null = null;

  return (
    <main>
      {page.blocks.map((block, index) => {
        const blockType = toStorybookBlockType(block.type || block.block_type || "");
        const rawBlockProps = (block.props || block.content || {}) as Record<string, unknown>;
        const blockProps = resolveBlockPropsWithBackgroundInheritance(
          blockType,
          rawBlockProps,
          previousBackground,
          backgroundByType
        );
        previousBackground = readPrimaryBackground(blockProps) || previousBackground;

        switch (blockType) {
          case 'site.header':
            return <SiteHeaderBlock key={index} {...(blockProps as SiteHeaderBlockProps)} />;
          case 'hero.standard':
            return <HeroBlock key={index} {...(blockProps as HeroBlockProps)} />;
          case 'trust.badges':
            return <TrustBadgesBlock key={index} {...(blockProps as TrustBadgesBlockProps)} />;
          case 'services.grid':
            return <ServicesGridBlock key={index} {...(blockProps as ServicesGridBlockProps)} />;
          case 'services.rates':
            return <ServiceRatesBlock key={index} {...(blockProps as ServiceRatesBlockProps)} />;
          case 'features.list':
            return <FeatureListBlock key={index} {...(blockProps as FeatureListBlockProps)} />;
          case 'about.intro':
            return <AboutIntroBlock key={index} {...(blockProps as AboutIntroBlockProps)} />;
          case 'process.steps':
            return <ProcessStepsBlock key={index} {...(blockProps as ProcessStepsBlockProps)} />;
          case 'reviews.grid':
            return <ReviewsBlock key={index} {...(blockProps as ReviewsBlockProps)} />;
          case 'areas.grid':
            return <AreasCoveredBlock key={index} {...(blockProps as AreasCoveredBlockProps)} />;
          case 'faq.accordion':
            return <FaqBlock key={index} {...(blockProps as FaqBlockProps)} />;
          case 'cta.banner':
            return <CtaBannerBlock key={index} {...(blockProps as CtaBannerBlockProps)} />;
          case 'contact.split':
            return <ContactBlock key={index} {...(blockProps as ContactBlockProps)} />;
          case 'gallery.grid':
            return <GalleryBlock key={index} {...(blockProps as GalleryBlockProps)} />;
          case 'blog.index':
            return <BlogIndexBlock key={index} {...(blockProps as BlogIndexBlockProps)} />;
          case 'legal.content':
            return <LegalContentBlock key={index} {...(blockProps as LegalContentBlockProps)} />;
          case 'system.notFound':
            return <NotFoundBlock key={index} {...(blockProps as NotFoundBlockProps)} />;
          case 'site.footer':
            return <SiteFooterBlock key={index} {...(blockProps as SiteFooterBlockProps)} />;
          default:
            return null;
        }
      })}
    </main>
  );
}
