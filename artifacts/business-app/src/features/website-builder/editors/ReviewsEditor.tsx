import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewsContent } from "../websiteBuilderTypes";

interface Props {
  value: ReviewsContent;
  onChange: (value: ReviewsContent) => void;
}

export default function ReviewsEditor({ value, onChange }: Props) {
  const update = (index: number, patch: Partial<ReviewsContent["items"][number]>) => {
    const items = value.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...value, items });
  };

  return (
    <div className="space-y-3">
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} /></div>
      {value.items.map((review, i) => (
        <div key={i} className="rounded border p-3 space-y-2">
          <div className="grid md:grid-cols-2 gap-2">
            <div><Label>Customer Name</Label><Input value={review.customerName} onChange={(e) => update(i, { customerName: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={review.location} onChange={(e) => update(i, { location: e.target.value })} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            <div><Label>Service</Label><Input value={review.service} onChange={(e) => update(i, { service: e.target.value })} /></div>
            <div><Label>Rating (1-5)</Label><Input type="number" min={1} max={5} value={review.rating} onChange={(e) => update(i, { rating: Number(e.target.value || 0) })} /></div>
          </div>
          <div><Label>Quote</Label><Textarea value={review.quote} onChange={(e) => update(i, { quote: e.target.value })} /></div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange({ ...value, items: [...value.items, { customerName: "", location: "", rating: 5, quote: "", service: "" }] })}>Add Review</Button>
    </div>
  );
}
