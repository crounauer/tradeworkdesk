import type { BusinessContent } from "@/features/website-builder/websiteBuilderTypes";

export default function BusinessInfoBlock({ business }: { business: BusinessContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h2 className="text-xl font-bold">{business.businessName}</h2>
      <p className="text-sm text-muted-foreground mt-1">{business.tagline}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {business.accreditations.map((item, i) => (
          <span key={`${item}-${i}`} className="text-xs rounded bg-secondary px-2 py-1">{item}</span>
        ))}
      </div>
    </section>
  );
}
