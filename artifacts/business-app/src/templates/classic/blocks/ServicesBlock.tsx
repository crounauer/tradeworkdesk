import type { ServicesContent } from "@/features/website-builder/websiteBuilderTypes";

export default function ServicesBlock({ services }: { services: ServicesContent }) {
  return (
    <section className="rounded-md border p-6 bg-white">
      <h3 className="text-lg font-semibold">{services.heading}</h3>
      <p className="text-sm text-muted-foreground mt-1">{services.intro}</p>
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {services.items.map((service, i) => (
          <div key={`${service.slug}-${i}`} className="rounded border p-3">
            <p className="font-medium">{service.title}</p>
            <p className="text-sm text-muted-foreground">{service.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
