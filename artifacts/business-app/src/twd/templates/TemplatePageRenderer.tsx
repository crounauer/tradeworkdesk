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
