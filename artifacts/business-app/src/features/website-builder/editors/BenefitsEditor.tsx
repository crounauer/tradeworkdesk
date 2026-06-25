import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BenefitsContent } from "../websiteBuilderTypes";

interface Props {
  value: BenefitsContent;
  onChange: (value: BenefitsContent) => void;
}

export default function BenefitsEditor({ value, onChange }: Props) {
  const updateItem = (index: number, field: "title" | "description" | "icon", fieldValue: string) => {
    const items = value.items.map((item, i) => (i === index ? { ...item, [field]: fieldValue } : item));
    onChange({ ...value, items });
  };

  return (
    <div className="space-y-3">
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} /></div>
      {value.items.map((item, i) => (
        <div key={i} className="rounded border p-3 space-y-2">
          <div className="grid md:grid-cols-2 gap-2">
            <div><Label>Title</Label><Input value={item.title} onChange={(e) => updateItem(i, "title", e.target.value)} /></div>
            <div><Label>Icon</Label><Input value={item.icon} onChange={(e) => updateItem(i, "icon", e.target.value)} /></div>
          </div>
          <div><Label>Description</Label><Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} /></div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange({ ...value, items: [...value.items, { title: "", description: "", icon: "" }] })}>Add Benefit</Button>
    </div>
  );
}
