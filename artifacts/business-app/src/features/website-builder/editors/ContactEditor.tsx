import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ContactContent } from "../websiteBuilderTypes";

interface Props {
  value: ContactContent;
  onChange: (value: ContactContent) => void;
}

export default function ContactEditor({ value, onChange }: Props) {
  const set = <K extends keyof ContactContent>(k: K, v: ContactContent[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div><Label>Heading</Label><Input value={value.heading} onChange={(e) => set("heading", e.target.value)} /></div>
      <div><Label>Intro</Label><Textarea value={value.intro} onChange={(e) => set("intro", e.target.value)} /></div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Phone</Label><Input value={value.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>Email</Label><Input value={value.email} onChange={(e) => set("email", e.target.value)} /></div>
      </div>
      <div><Label>Address</Label><Input value={value.address} onChange={(e) => set("address", e.target.value)} /></div>
      <div><Label>Opening Hours</Label><Input value={value.openingHours} onChange={(e) => set("openingHours", e.target.value)} /></div>
      <div><Label>Emergency Text</Label><Textarea value={value.emergencyText} onChange={(e) => set("emergencyText", e.target.value)} /></div>
      <div className="flex items-center gap-2">
        <Switch checked={value.formEnabled} onCheckedChange={(v) => set("formEnabled", v)} />
        <Label>Form Enabled</Label>
      </div>
    </div>
  );
}
