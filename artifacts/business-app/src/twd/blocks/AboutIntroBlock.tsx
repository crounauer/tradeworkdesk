export type AboutIntroBlockProps = {
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: string[];
};

export function AboutIntroBlock({
  eyebrow = 'About us',
  title,
  body,
  bullets = [],
}: AboutIntroBlockProps) {
  return (
    <section className="bg-white px-6 py-20 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
        </div>

        <div>
          <p className="text-lg leading-8 text-slate-600">{body}</p>

          {bullets.length > 0 ? (
            <ul className="mt-8 grid gap-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="rounded-lg bg-slate-50 px-4 py-3 font-medium text-slate-800">
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
