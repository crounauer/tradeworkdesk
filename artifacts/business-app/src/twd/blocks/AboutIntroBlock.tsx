export type AboutIntroBlockProps = {
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: string[];
  variant?: 'default' | 'classic';
  background?: 'default' | 'white' | 'light';
  tone?: 'default' | 'formal';
};

export function AboutIntroBlock({
  eyebrow = 'About us',
  title,
  body,
  bullets = [],
  variant = 'default',
  background = 'default',
  tone = 'default',
}: AboutIntroBlockProps) {
  const isClassic = variant === 'classic';
  const isFormal = tone === 'formal';
  const sectionClassName = background === 'light'
    ? 'bg-slate-50 px-6 py-20 lg:px-8'
    : 'bg-white px-6 py-20 lg:px-8';
  const bulletClassName = isClassic
    ? 'rounded-sm border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800'
    : 'rounded-lg bg-slate-50 px-4 py-3 font-medium text-slate-800';

  return (
    <section className={sectionClassName}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
        </div>

        <div>
          <p className={`text-lg leading-8 text-slate-600 ${isFormal ? 'max-w-2xl' : ''}`}>{body}</p>

          {bullets.length > 0 ? (
            <ul className="mt-8 grid gap-3">
              {bullets.map((bullet) => (
                <li key={bullet} className={bulletClassName}>
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
