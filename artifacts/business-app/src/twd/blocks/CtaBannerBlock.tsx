export type CtaBannerBlockProps = {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  phone?: string;
};

export function CtaBannerBlock({
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  phone,
}: CtaBannerBlockProps) {
  return (
    <section className="bg-amber-400 px-6 py-16 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-3 max-w-2xl text-slate-800">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="#contact" className="rounded-md bg-slate-950 px-5 py-3 font-bold text-white">
            {primaryCtaLabel}
          </a>

          {secondaryCtaLabel && phone ? (
            <a href={'tel:' + phone} className="rounded-md border border-slate-950 px-5 py-3 font-bold text-slate-950">
              {secondaryCtaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
