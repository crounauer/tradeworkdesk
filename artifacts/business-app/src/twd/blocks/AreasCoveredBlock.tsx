import type { AreaItem } from '../types';

export type AreasCoveredBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  areas: AreaItem[];
};

export function AreasCoveredBlock({
  eyebrow = 'Areas covered',
  title,
  subtitle,
  areas,
}: AreasCoveredBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((area) => {
            const content = (
              <span className="block rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800">
                {area.name}
              </span>
            );

            return area.href ? (
              <a key={area.name} href={area.href}>{content}</a>
            ) : (
              <div key={area.name}>{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
