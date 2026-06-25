import type { BenefitsContent } from "@/features/website-builder/websiteBuilderTypes";

export default function BenefitsBlock({ benefits }: { benefits: BenefitsContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold mb-3">{benefits.heading}</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {benefits.items.map((item, i) => (
          <div key={`${item.title}-${i}`} className="rounded border p-3">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
