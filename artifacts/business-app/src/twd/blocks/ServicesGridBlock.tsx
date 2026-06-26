import type { ServiceItem } from '../types';

export type ServicesGridBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  services: ServiceItem[];
};

export function ServicesGridBlock({
  eyebrow = 'Services',
  title,
  subtitle,
  services,
}: ServicesGridBlockProps) {
  return (
    <section id="services" className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-lg text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <article key={service.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-950">{service.title}</h3>
              <p className="mt-3 text-slate-600">{service.description}</p>
              {service.href ? (
                <a href={service.href} className="mt-5 inline-block font-semibold text-slate-950">
                  Learn more →
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
