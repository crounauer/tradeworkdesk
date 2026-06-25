import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HeroContent } from "../websiteBuilderTypes";

interface Props {
  value: HeroContent;
  onChange: (value: HeroContent) => void;
}

export default function HeroEditor({ value, onChange }: Props) {
  const set = (k: keyof HeroContent, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div><Label>Eyebrow</Label><Input value={value.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></div>
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => set("heading", e.target.value)} /></div>
      <div><Label>Subheading</Label><Input value={value.subheading} onChange={(e) => set("subheading", e.target.value)} /></div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Primary Button Text</Label><Input value={value.primaryButtonText} onChange={(e) => set("primaryButtonText", e.target.value)} /></div>
        <div><Label>Primary Button URL</Label><Input value={value.primaryButtonUrl} onChange={(e) => set("primaryButtonUrl", e.target.value)} /></div>
        <div><Label>Secondary Button Text</Label><Input value={value.secondaryButtonText} onChange={(e) => set("secondaryButtonText", e.target.value)} /></div>
        <div><Label>Secondary Button URL</Label><Input value={value.secondaryButtonUrl} onChange={(e) => set("secondaryButtonUrl", e.target.value)} /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Image URL</Label><Input value={value.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} /></div>
        <div><Label>Image Alt</Label><Input value={value.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} /></div>
      </div>
    </div>
  );
}
