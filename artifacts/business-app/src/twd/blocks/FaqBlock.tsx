import type { FaqItem } from '../types';

export type FaqBlockProps = {
  eyebrow?: string;
  title: string;
  faqs: FaqItem[];
};

export function FaqBlock({
  eyebrow = 'FAQ',
  title,
  faqs,
}: FaqBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>

        <div className="mt-10 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {faqs.map((faq) => (
            <details key={faq.question} className="group p-6">
              <summary className="cursor-pointer list-none font-semibold text-slate-950">
                {faq.question}
              </summary>
              <p className="mt-3 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
