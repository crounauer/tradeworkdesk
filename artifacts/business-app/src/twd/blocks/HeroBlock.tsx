export type HeroBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  phone?: string;
  imageAlt?: string;
};

export function HeroBlock({
  eyebrow = 'Local trade specialists',
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  phone,
  imageAlt = 'Trade business image placeholder',
}: HeroBlockProps) {
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center lg:px-8">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-400">
            {eyebrow}
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {title}
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-200">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a href="#contact" className="rounded-md bg-amber-400 px-5 py-3 font-semibold text-slate-950">
              {primaryCtaLabel}
            </a>

            {secondaryCtaLabel ? (
              <a href="#services" className="rounded-md border border-white/30 px-5 py-3 font-semibold text-white">
                {secondaryCtaLabel}
              </a>
            ) : null}
          </div>

          {phone ? (
            <p className="mt-6 text-sm text-slate-300">
              Prefer to call? <span className="font-semibold text-white">{phone}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-slate-800 p-6 shadow-xl">
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-700 text-center text-sm text-slate-300">
            {imageAlt}
          </div>
        </div>
      </div>
    </section>
  );
}
