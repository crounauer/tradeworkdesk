import type { ServicesContent } from "@/features/website-builder/websiteBuilderTypes";

export default function FeaturedProjectBlock({ services }: { services: ServicesContent }) {
  const item = services.items[0];
  if (!item) return null;
  return (
    <section className="rounded-md border p-6 bg-white">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Project highlight</p>
      <h3 className="text-lg font-semibold mt-2">{item.title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
    </section>
  );
}
