import type { LegalSection } from '../types';

export type LegalContentBlockProps = {
  title: string;
  updatedDate?: string;
  sections: LegalSection[];
};

export function LegalContentBlock({
  title,
  updatedDate,
  sections,
}: LegalContentBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950">{title}</h1>
        {updatedDate ? <p className="mt-3 text-sm text-slate-500">Last updated: {updatedDate}</p> : null}

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold text-slate-950">{section.heading}</h2>
              <p className="mt-3 leading-7 text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
