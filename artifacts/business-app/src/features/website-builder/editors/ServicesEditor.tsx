import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ServicesContent } from "../websiteBuilderTypes";

interface Props {
  value: ServicesContent;
  onChange: (value: ServicesContent) => void;
}

export default function ServicesEditor({ value, onChange }: Props) {
  const updateService = (index: number, patch: Partial<ServicesContent["items"][number]>) => {
    const items = value.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...value, items });
  };

  return (
    <div className="space-y-3">
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} /></div>
      <div><Label>Intro</Label><Textarea value={value.intro} onChange={(e) => onChange({ ...value, intro: e.target.value })} /></div>
      {value.items.map((service, i) => (
        <div key={i} className="rounded border p-3 space-y-2">
          <div className="grid md:grid-cols-2 gap-2">
            <div><Label>Title</Label><Input value={service.title} onChange={(e) => updateService(i, { title: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={service.slug} onChange={(e) => updateService(i, { slug: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={service.description} onChange={(e) => updateService(i, { description: e.target.value })} /></div>
          <div className="grid md:grid-cols-2 gap-2">
            <div><Label>Image URL</Label><Input value={service.imageUrl} onChange={(e) => updateService(i, { imageUrl: e.target.value })} /></div>
            <div><Label>Image Alt</Label><Input value={service.imageAlt} onChange={(e) => updateService(i, { imageAlt: e.target.value })} /></div>
          </div>
          <div><Label>Features (comma separated)</Label><Input value={service.features.join(", ")} onChange={(e) => updateService(i, { features: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange({ ...value, items: [...value.items, { title: "", description: "", imageUrl: "", imageAlt: "", slug: "", features: [] }] })}>Add Service</Button>
    </div>
  );
}
