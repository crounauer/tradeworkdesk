import type { ProcessStep } from '../types';

export type ProcessStepsBlockProps = {
  eyebrow?: string;
  title: string;
  steps: ProcessStep[];
  variant?: 'default' | 'classic';
  layout?: 'grid' | 'timeline';
  tone?: 'dark' | 'light';
};

export function ProcessStepsBlock({
  eyebrow = 'How it works',
  title,
  steps,
  variant = 'default',
  layout = 'grid',
  tone = 'dark',
}: ProcessStepsBlockProps) {
  const isClassic = variant === 'classic';
  const isLight = tone === 'light';
  const sectionClassName = isLight
    ? 'bg-[#f0f4f9] px-6 py-20 text-slate-900 lg:px-8'
    : 'bg-slate-950 px-6 py-20 text-white lg:px-8';
  const gridClassName = layout === 'timeline'
    ? 'mt-10 grid gap-4'
    : 'mt-10 grid gap-6 md:grid-cols-3';
  const cardClassName = isLight
    ? isClassic
      ? 'rounded-sm border border-slate-300 bg-white p-6'
      : 'rounded-xl border border-slate-200 bg-white p-6'
    : 'rounded-xl border border-white/10 bg-white/5 p-6';
  const numberClassName = isClassic
    ? 'flex h-10 w-10 items-center justify-center rounded-sm bg-[#00a8a8] font-bold text-white'
    : 'flex h-10 w-10 items-center justify-center rounded-full bg-[#00a8a8] font-bold text-white';
  const bodyClassName = isLight ? 'mt-3 text-slate-600' : 'mt-3 text-slate-300';

  return (
    <section className={sectionClassName}>
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a6b]">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>

        <div className={gridClassName}>
          {steps.map((step, index) => (
            <article key={step.title} className={cardClassName}>
              <div className={numberClassName}>
                {index + 1}
              </div>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className={bodyClassName}>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
