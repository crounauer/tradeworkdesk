import type { FeatureItem } from '../types';

export type FeatureListBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  features: FeatureItem[];
};

export function FeatureListBlock({
  eyebrow = 'Why choose us',
  title,
  subtitle,
  features,
}: FeatureListBlockProps) {
  return (
    <section className="bg-[#f0f4f9] px-6 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a6b]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-4 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="grid gap-6 lg:col-span-2 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-950">{feature.title}</h3>
              <p className="mt-2 text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
