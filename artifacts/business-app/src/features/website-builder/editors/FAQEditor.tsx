import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FaqsContent } from "../websiteBuilderTypes";

interface Props {
  value: FaqsContent;
  onChange: (value: FaqsContent) => void;
}

export default function FAQEditor({ value, onChange }: Props) {
  const update = (index: number, patch: Partial<FaqsContent["items"][number]>) => {
    const items = value.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...value, items });
  };

  return (
    <div className="space-y-3">
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} /></div>
      {value.items.map((faq, i) => (
        <div key={i} className="rounded border p-3 space-y-2">
          <div><Label>Question</Label><Input value={faq.question} onChange={(e) => update(i, { question: e.target.value })} /></div>
          <div><Label>Answer</Label><Textarea value={faq.answer} onChange={(e) => update(i, { answer: e.target.value })} /></div>
          <Button variant="outline" size="sm" onClick={() => onChange({ ...value, items: value.items.filter((_, idx) => idx !== i) })}>Remove</Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange({ ...value, items: [...value.items, { question: "", answer: "" }] })}>Add FAQ</Button>
    </div>
  );
}
