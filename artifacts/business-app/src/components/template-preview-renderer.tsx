/**
 * TemplatePreviewRenderer
 * Admin-only component that renders template blocks by mapping block_type to imported block components
 */

import { Component, type ReactNode } from "react";

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

type BlockErrorBoundaryProps = {
  block: TemplateBlock;
  children: ReactNode;
};

type BlockErrorBoundaryState = {
  hasError: boolean;
};

class BlockErrorBoundary extends Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  state: BlockErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): BlockErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      const { block } = this.props;
      return (
        <div className="bg-amber-50 border border-amber-200 px-6 py-12 text-center">
          <p className="text-sm font-medium text-amber-800">
            Failed to render block <span className="font-mono text-xs bg-amber-100 px-2 py-1 rounded">{block.block_type}</span>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Maps block_type strings to block components
 * Content is passed directly to the component
 */
function BlockComponent({ block }: BlockRendererProps) {
  const { block_type, content = {} } = block;
  const contentObj = content as Record<string, unknown>;
  const props = (contentObj.props && typeof contentObj.props === "object"
    ? (contentObj.props as Record<string, unknown>)
    : contentObj) as Record<string, unknown>;
  const resolvedType = toStorybookBlockType(block_type);

  const defaultPropsByType: Record<string, Record<string, unknown>> = {
    "site.header": {
      logoText: "Local Plumbing Pro",
      navItems: [
        { label: "Home", href: "/" },
        { label: "Services", href: "/services" },
        { label: "Contact", href: "/contact" },
      ],
      ctaLabel: "Get quote",
      ctaHref: "#contact",
      phone: "01234 567890",
      scheduleText: "Mon-Sat 7am-8pm | Emergency 24/7",
      locationText: "Reading & Surrounding Areas",
    },
    "site.footer": {
      logoText: "Local Plumbing Pro",
      description: "Trusted local trade specialists.",
      navItems: [
        { label: "Home", href: "/" },
        { label: "Services", href: "/services" },
        { label: "Contact", href: "/contact" },
      ],
      legalLinks: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
      phone: "01234 567890",
      email: "hello@example.com",
    },
    "hero.standard": {
      title: "Reliable local trade services",
      subtitle: "Fast response, clear pricing, and quality workmanship.",
      primaryCtaLabel: "Book now",
      primaryCtaHref: "#contact",
      trustBadges: ["Fully Insured", "Local Engineers", "Fast Response", "Free Quotes"],
    },
    "trust.badges": {
      badges: [
        { label: "Fully Insured", description: "Public liability cover in place" },
        { label: "Gas Safe", description: "Certified and compliant" },
        { label: "5-Star Rated", description: "Trusted by local customers" },
      ],
    },
    "services.grid": {
      title: "Our services",
      services: [
        { title: "Boiler Service", description: "Annual servicing for safety and efficiency" },
        { title: "Repairs", description: "Rapid diagnostics and reliable fixes" },
        { title: "Installations", description: "Professional installation and setup" },
      ],
    },
    "features.list": {
      title: "Why choose us",
      features: [
        { title: "Fast response", description: "Same-day callouts available" },
        { title: "Clear pricing", description: "No hidden fees" },
        { title: "Quality workmanship", description: "Experienced local engineers" },
      ],
    },
    "about.intro": {
      title: "About our team",
      body: "We provide dependable trade services with a focus on quality and customer care.",
    },
    "process.steps": {
      title: "How it works",
      steps: [
        { title: "Book", description: "Choose a suitable date and time" },
        { title: "Visit", description: "Engineer arrives and completes the work" },
        { title: "Follow-up", description: "We confirm everything is working perfectly" },
      ],
    },
    "reviews.grid": {
      title: "Customer reviews",
      reviews: [
        { name: "A. Smith", quote: "Great service and very professional.", rating: 5 },
        { name: "J. Brown", quote: "Arrived on time and fixed it quickly.", rating: 5 },
        { name: "K. Jones", quote: "Highly recommended.", rating: 5 },
      ],
    },
    "areas.grid": {
      title: "Areas we cover",
      areas: [
        { name: "City Centre" },
        { name: "Northside" },
        { name: "Southside" },
        { name: "West End" },
      ],
    },
    "faq.accordion": {
      title: "Frequently asked questions",
      faqs: [
        { question: "Do you offer emergency callouts?", answer: "Yes, we provide emergency support." },
        { question: "Are quotes free?", answer: "Yes, we provide free no-obligation quotes." },
      ],
    },
    "cta.banner": {
      title: "Need help today?",
      subtitle: "Book an appointment and we will get back to you quickly.",
      primaryCtaLabel: "Book now",
      secondaryCtaLabel: "Call us",
      phone: "01234 567890",
    },
    "contact.split": {
      title: "Get in touch",
      subtitle: "Tell us what you need and we will respond promptly.",
      phone: "01234 567890",
      email: "hello@example.com",
      address: "123 High Street",
      openingHours: "Mon-Fri 8:00-18:00",
    },
    "gallery.grid": {
      title: "Recent work",
      images: [
        { alt: "Project 1", caption: "Installation" },
        { alt: "Project 2", caption: "Repair" },
        { alt: "Project 3", caption: "Maintenance" },
      ],
    },
    "blog.index": {
      title: "Latest articles",
      posts: [
        { href: "/blog/1", title: "Maintenance tips", excerpt: "Simple ways to prevent breakdowns." },
        { href: "/blog/2", title: "When to service", excerpt: "How often your system should be checked." },
        { href: "/blog/3", title: "Energy savings", excerpt: "Reduce bills with efficient usage." },
      ],
    },
    "legal.content": {
      title: "Legal information",
      sections: [
        { heading: "Overview", body: "This is placeholder legal content for preview." },
      ],
    },
    "system.404": {
      title: "Page not found",
      subtitle: "The page you are looking for could not be found.",
      ctaLabel: "Back to home",
      ctaHref: "/",
    },
  };

  const safeProps = {
    ...(defaultPropsByType[resolvedType] || {}),
    ...props,
  } as Record<string, unknown>;

  switch (resolvedType) {
    case 'site.header':
      return <SiteHeaderBlock {...(safeProps as any)} />;
    case 'site.footer':
      return <SiteFooterBlock {...(safeProps as any)} />;
    case 'hero.standard':
      return <HeroBlock {...(safeProps as any)} />;
    case 'trust.badges':
      return <TrustBadgesBlock {...(safeProps as any)} />;
    case 'services.grid':
      return <ServicesGridBlock {...(safeProps as any)} />;
    case 'features.list':
      return <FeatureListBlock {...(safeProps as any)} />;
    case 'about.intro':
      return <AboutIntroBlock {...(safeProps as any)} />;
    case 'process.steps':
      return <ProcessStepsBlock {...(safeProps as any)} />;
    case 'reviews.grid':
      return <ReviewsBlock {...(safeProps as any)} />;
    case 'areas.grid':
      return <AreasCoveredBlock {...(safeProps as any)} />;
    case 'faq.accordion':
      return <FaqBlock {...(safeProps as any)} />;
    case 'cta.banner':
      return <CtaBannerBlock {...(safeProps as any)} />;
    case 'contact.split':
      return <ContactBlock {...(safeProps as any)} />;
    case 'gallery.grid':
      return <GalleryBlock {...(safeProps as any)} />;
    case 'blog.index':
      return <BlogIndexBlock {...(safeProps as any)} />;
    case 'legal.content':
      return <LegalContentBlock {...(safeProps as any)} />;
    case 'system.404':
      return <NotFoundBlock {...(safeProps as any)} />;

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
          <BlockErrorBoundary block={block}>
            <BlockComponent block={block} />
          </BlockErrorBoundary>
        </div>
      ))}
    </div>
  );
}
