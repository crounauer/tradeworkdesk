import type { ServiceItem } from '../types';

export type ServicesGridBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  services: ServiceItem[];
  variant?: 'default' | 'classic';
  layout?: 'grid' | 'list';
  background?: 'default' | 'white' | 'light';
  cardStyle?: 'default' | 'bordered-traditional';
  density?: 'normal' | 'compact';
};

export function ServicesGridBlock({
  eyebrow = 'Services',
  title,
  subtitle,
  services,
  variant = 'default',
  layout = 'grid',
  background = 'default',
  cardStyle = 'default',
  density = 'normal',
}: ServicesGridBlockProps) {
  const isClassic = variant === 'classic';
  const sectionClassName = background === 'light'
    ? 'bg-[#f0f4f9] px-6 py-20 lg:px-8'
    : background === 'white'
      ? 'bg-white px-6 py-20 lg:px-8'
      : 'bg-white px-6 py-20 lg:px-8';
  const gridClassName = layout === 'list'
    ? 'mt-10 grid gap-4'
    : density === 'compact'
      ? 'mt-10 grid gap-4 md:grid-cols-3'
      : 'mt-10 grid gap-6 md:grid-cols-3';
  const cardClassName = cardStyle === 'bordered-traditional' || isClassic
    ? 'rounded-sm border border-slate-300 bg-white p-6'
    : 'rounded-xl border border-slate-200 bg-slate-50 p-6';
  const linkClassName = isClassic ? 'mt-5 inline-block font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4' : 'mt-5 inline-block font-semibold text-slate-950';

  return (
    <section id="services" className={sectionClassName}>
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a6b]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-lg text-slate-600">{subtitle}</p> : null}
        </div>

        <div className={gridClassName}>
          {services.map((service) => (
            <article key={service.title} className={cardClassName}>
              <h3 className="text-xl font-semibold text-slate-950">{service.title}</h3>
              <p className="mt-3 text-slate-600">{service.description}</p>
              {service.href ? (
                <a href={service.href} className={linkClassName}>
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
