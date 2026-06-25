import type { AreasContent } from "@/features/website-builder/websiteBuilderTypes";

export default function AreasBlock({ areas }: { areas: AreasContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold">{areas.heading}</h3>
      <p className="text-sm text-muted-foreground mt-1">{areas.intro}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {areas.items.map((area, i) => (
          <span key={`${area.slug}-${i}`} className="text-xs rounded bg-secondary px-2 py-1">{area.name}</span>
        ))}
      </div>
    </section>
  );
}
