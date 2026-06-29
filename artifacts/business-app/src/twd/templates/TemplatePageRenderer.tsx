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

export function TemplatePageRenderer({ page }: { page: TemplatePage }) {
  return (
    <main>
      {page.blocks.map((block, index) => {
        const blockType = toStorybookBlockType(block.type || block.block_type || "");
        const blockProps = (block.props || block.content || {}) as Record<string, unknown>;

        switch (blockType) {
          case 'site.header':
            return <SiteHeaderBlock key={index} {...(blockProps as SiteHeaderBlockProps)} />;
          case 'hero.standard':
            return <HeroBlock key={index} {...(blockProps as HeroBlockProps)} />;
          case 'trust.badges':
            return <TrustBadgesBlock key={index} {...(blockProps as TrustBadgesBlockProps)} />;
          case 'services.grid':
            return <ServicesGridBlock key={index} {...(blockProps as ServicesGridBlockProps)} />;
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
