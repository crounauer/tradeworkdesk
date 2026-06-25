import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AreasContent } from "../websiteBuilderTypes";

interface Props {
  value: AreasContent;
  onChange: (value: AreasContent) => void;
}

export default function AreasEditor({ value, onChange }: Props) {
  const update = (index: number, patch: Partial<AreasContent["items"][number]>) => {
    const items = value.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...value, items });
  };

  return (
    <div className="space-y-3">
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} /></div>
      <div><Label>Intro</Label><Textarea value={value.intro} onChange={(e) => onChange({ ...value, intro: e.target.value })} /></div>
      {value.items.map((area, i) => (
        <div key={i} className="rounded border p-3 space-y-2">
          <div><Label>Name</Label><Input value={area.name} onChange={(e) => update(i, { name: e.target.value })} /></div>
          <div><Label>Slug</Label><Input value={area.slug} onChange={(e) => update(i, { slug: e.target.value })} /></div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange({ ...value, items: [...value.items, { name: "", slug: "" }] })}>Add Area</Button>
    </div>
  );
}
