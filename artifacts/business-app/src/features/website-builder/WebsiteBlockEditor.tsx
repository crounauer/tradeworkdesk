import HeroEditor from "./editors/HeroEditor";
import BenefitsEditor from "./editors/BenefitsEditor";
import ServicesEditor from "./editors/ServicesEditor";
import ReviewsEditor from "./editors/ReviewsEditor";
import AreasEditor from "./editors/AreasEditor";
import FAQEditor from "./editors/FAQEditor";
import ContactEditor from "./editors/ContactEditor";
import BusinessInfoEditor from "./editors/BusinessInfoEditor";
import type { TenantWebsiteContent, WebsiteBlockType } from "./websiteBuilderTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  blockType: WebsiteBlockType;
  content: TenantWebsiteContent;
  onChange: (next: TenantWebsiteContent) => void;
}

export default function WebsiteBlockEditor({ blockType, content, onChange }: Props) {
  switch (blockType) {
    case "business_info":
      return <BusinessInfoEditor value={content.business} onChange={(business) => onChange({ ...content, business })} />;
    case "hero":
      return <HeroEditor value={content.hero} onChange={(hero) => onChange({ ...content, hero })} />;
    case "benefits":
      return <BenefitsEditor value={content.benefits} onChange={(benefits) => onChange({ ...content, benefits })} />;
    case "services":
    case "featured_project":
      return <ServicesEditor value={content.services} onChange={(services) => onChange({ ...content, services })} />;
    case "process":
      return (
        <div className="space-y-3">
          <div>
            <Label>Heading</Label>
            <Input
              value={content.process.heading}
              onChange={(e) => onChange({ ...content, process: { ...content.process, heading: e.target.value } })}
            />
          </div>
          {content.process.steps.map((step, i) => (
            <div key={i} className="rounded border p-3 space-y-2">
              <div>
                <Label>Step title</Label>
                <Input
                  value={step.title}
                  onChange={(e) => {
                    const steps = content.process.steps.map((s, idx) => (idx === i ? { ...s, title: e.target.value } : s));
                    onChange({ ...content, process: { ...content.process, steps } });
                  }}
                />
              </div>
              <div>
                <Label>Step description</Label>
                <Input
                  value={step.description}
                  onChange={(e) => {
                    const steps = content.process.steps.map((s, idx) => (idx === i ? { ...s, description: e.target.value } : s));
                    onChange({ ...content, process: { ...content.process, steps } });
                  }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const steps = content.process.steps.filter((_, idx) => idx !== i);
                  onChange({ ...content, process: { ...content.process, steps } });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() => onChange({ ...content, process: { ...content.process, steps: [...content.process.steps, { title: "", description: "" }] } })}
          >
            Add Step
          </Button>
        </div>
      );
    case "trust_bar":
      return <BusinessInfoEditor value={content.business} onChange={(business) => onChange({ ...content, business })} />;
    case "reviews":
      return <ReviewsEditor value={content.reviews} onChange={(reviews) => onChange({ ...content, reviews })} />;
    case "areas":
      return <AreasEditor value={content.areas} onChange={(areas) => onChange({ ...content, areas })} />;
    case "faq":
      return <FAQEditor value={content.faqs} onChange={(faqs) => onChange({ ...content, faqs })} />;
    case "contact":
      return <ContactEditor value={content.contact} onChange={(contact) => onChange({ ...content, contact })} />;
    default:
      return null;
  }
}
