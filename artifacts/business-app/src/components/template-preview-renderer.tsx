/**
 * TemplatePreviewRenderer
 * Admin-only component that renders template blocks by mapping block_type to imported block components
 */

import {
  SiteHeaderBlock,
  SiteFooterBlock,
  HeroBlock,
  TrustBadgesBlock,
  ServicesGridBlock,
  FeatureListBlock,
  AboutIntroBlock,
  ProcessStepsBlock,
  ReviewsBlock,
  AreasCoveredBlock,
  FaqBlock,
  CtaBannerBlock,
  ContactBlock,
  GalleryBlock,
  BlogIndexBlock,
  LegalContentBlock,
  NotFoundBlock,
} from '@/twd/blocks';
import { toStorybookBlockType } from '@/twd/templates/blockTypeParity';

export type TemplateBlock = {
  id: string;
  block_type: string;
  label?: string;
  sort_order: number;
  content?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

type BlockRendererProps = {
  block: TemplateBlock;
};

/**
 * Maps block_type strings to block components
 * Content is passed directly to the component
 */
function BlockComponent({ block }: BlockRendererProps) {
  const { block_type, content = {} } = block;
  const props = content as Record<string, unknown>;
  const resolvedType = toStorybookBlockType(block_type);

  switch (resolvedType) {
    case 'site.header':
      return <SiteHeaderBlock {...(props as any)} />;
    case 'site.footer':
      return <SiteFooterBlock {...(props as any)} />;
    case 'hero.standard':
      return <HeroBlock {...(props as any)} />;
    case 'trust.badges':
      return <TrustBadgesBlock {...(props as any)} />;
    case 'services.grid':
      return <ServicesGridBlock {...(props as any)} />;
    case 'features.list':
      return <FeatureListBlock {...(props as any)} />;
    case 'about.intro':
      return <AboutIntroBlock {...(props as any)} />;
    case 'process.steps':
      return <ProcessStepsBlock {...(props as any)} />;
    case 'reviews.grid':
      return <ReviewsBlock {...(props as any)} />;
    case 'areas.grid':
      return <AreasCoveredBlock {...(props as any)} />;
    case 'faq.accordion':
      return <FaqBlock {...(props as any)} />;
    case 'cta.banner':
      return <CtaBannerBlock {...(props as any)} />;
    case 'contact.split':
      return <ContactBlock {...(props as any)} />;
    case 'gallery.grid':
      return <GalleryBlock {...(props as any)} />;
    case 'blog.index':
      return <BlogIndexBlock {...(props as any)} />;
    case 'legal.content':
      return <LegalContentBlock {...(props as any)} />;
    case 'system.404':
      return <NotFoundBlock {...(props as any)} />;

    default:
      return (
        <div className="bg-slate-100 border border-dashed border-slate-300 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            Block type <span className="font-mono text-xs bg-slate-200 px-2 py-1 rounded">{block_type}</span> not supported in preview
          </p>
          {block.label && <p className="text-xs text-slate-500 mt-1">{block.label}</p>}
        </div>
      );
  }
}

type TemplatePreviewRendererProps = {
  blocks: TemplateBlock[];
};

export function TemplatePreviewRenderer({ blocks }: TemplatePreviewRendererProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="bg-slate-50 px-6 py-20 text-center">
        <p className="text-slate-500">No blocks to display</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {blocks.map((block) => (
        <div key={block.id} className="relative group">
          {/* Admin label on hover */}
          <div className="absolute -top-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded pointer-events-none z-10">
            {block.block_type} {block.sort_order + 1}
          </div>
          <BlockComponent block={block} />
        </div>
      ))}
    </div>
  );
}
