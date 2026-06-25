import type { BusinessContent } from "@/features/website-builder/websiteBuilderTypes";

export default function TrustBarBlock({ business }: { business: BusinessContent }) {
  return (
    <section className="rounded-md border p-4 bg-white">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Accreditations</p>
      <div className="flex flex-wrap gap-2">
        {business.accreditations.map((item, i) => (
          <span key={`${item}-${i}`} className="text-xs rounded border px-2 py-1">{item}</span>
        ))}
      </div>
    </section>
  );
}
