import type { TenantWebsiteContent, WebsiteTemplate, WebsiteTheme } from "@/features/website-builder/websiteBuilderTypes";
import BusinessInfoBlock from "./blocks/BusinessInfoBlock";
import HeroBlock from "./blocks/HeroBlock";
import BenefitsBlock from "./blocks/BenefitsBlock";
import ServicesBlock from "./blocks/ServicesBlock";
import ProcessBlock from "./blocks/ProcessBlock";
import FeaturedProjectBlock from "./blocks/FeaturedProjectBlock";
import TrustBarBlock from "./blocks/TrustBarBlock";
import ReviewsBlock from "./blocks/ReviewsBlock";
import AreasBlock from "./blocks/AreasBlock";
import FaqBlock from "./blocks/FaqBlock";
import ContactBlock from "./blocks/ContactBlock";

interface Props {
  template: WebsiteTemplate;
  theme: WebsiteTheme;
  content: TenantWebsiteContent;
  pageSlug: string;
}

function renderBlock(blockType: string, content: TenantWebsiteContent) {
  switch (blockType) {
    case "business_info":
      return <BusinessInfoBlock business={content.business} />;
    case "hero":
      return <HeroBlock hero={content.hero} />;
    case "benefits":
      return <BenefitsBlock benefits={content.benefits} />;
    case "services":
      return <ServicesBlock services={content.services} />;
    case "process":
      return <ProcessBlock process={content.process} />;
    case "featured_project":
      return <FeaturedProjectBlock services={content.services} />;
    case "trust_bar":
      return <TrustBarBlock business={content.business} />;
    case "reviews":
      return <ReviewsBlock reviews={content.reviews} />;
    case "areas":
      return <AreasBlock areas={content.areas} />;
    case "faq":
      return <FaqBlock faqs={content.faqs} />;
    case "contact":
      return <ContactBlock contact={content.contact} />;
    default:
      return null;
  }
}

export default function TemplateRenderer({ template, theme, content, pageSlug }: Props) {
  const page = template.pages.find((p) => p.slug === pageSlug) ?? template.pages[0];

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{
        background: theme.colors.background,
        color: theme.colors.foreground,
        borderColor: theme.colors.border,
        fontFamily: theme.fonts.body,
      }}
    >
      {page.blocks.map((block) => (
        <div key={block.id}>{renderBlock(block.type, content)}</div>
      ))}
    </div>
  );
}
