import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessContent } from "../websiteBuilderTypes";

interface Props {
  value: BusinessContent;
  onChange: (value: BusinessContent) => void;
}

export default function BusinessInfoEditor({ value, onChange }: Props) {
  const set = <K extends keyof BusinessContent>(k: K, v: BusinessContent[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div><Label>Business Name</Label><Input value={value.businessName} onChange={(e) => set("businessName", e.target.value)} /></div>
      <div><Label>Tagline</Label><Input value={value.tagline} onChange={(e) => set("tagline", e.target.value)} /></div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Phone</Label><Input value={value.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>Email</Label><Input value={value.email} onChange={(e) => set("email", e.target.value)} /></div>
      </div>
      <div><Label>Address</Label><Input value={value.address} onChange={(e) => set("address", e.target.value)} /></div>
      <div><Label>Logo URL</Label><Input value={value.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} /></div>
      <div>
        <Label>Accreditations (one per line)</Label>
        <textarea
          className="w-full min-h-24 rounded border px-3 py-2 text-sm"
          value={value.accreditations.join("\n")}
          onChange={(e) => set("accreditations", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
        />
      </div>
      <Button size="sm" variant="outline" onClick={() => set("accreditations", [...value.accreditations, "New Accreditation"])}>Add Accreditation</Button>
    </div>
  );
}
