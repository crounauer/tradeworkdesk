import type { ProcessStep } from '../types';

export type ProcessStepsBlockProps = {
  eyebrow?: string;
  title: string;
  steps: ProcessStep[];
};

export function ProcessStepsBlock({
  eyebrow = 'How it works',
  title,
  steps,
}: ProcessStepsBlockProps) {
  return (
    <section className="bg-slate-950 px-6 py-20 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">
                {index + 1}
              </div>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-slate-300">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
