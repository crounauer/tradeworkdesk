export type CtaBannerBlockProps = {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  phone?: string;
  ctaStyle?: 'default' | 'classic-amber' | 'classic-navy';
  tone?: 'default' | 'practical';
  background?: 'default' | 'amber' | 'navy';
};

export function CtaBannerBlock({
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  phone,
  ctaStyle = 'default',
  tone = 'default',
  background = 'default',
}: CtaBannerBlockProps) {
  const useAmber = background === 'amber' || ctaStyle === 'classic-amber' || (background === 'default' && ctaStyle === 'default');
  const sectionClassName = useAmber
    ? 'bg-amber-400 px-6 py-16 lg:px-8'
    : 'bg-slate-900 px-6 py-16 text-white lg:px-8';
  const titleClassName = useAmber ? 'text-3xl font-bold tracking-tight text-slate-950' : 'text-3xl font-bold tracking-tight text-white';
  const subtitleClassName = useAmber ? 'mt-3 max-w-2xl text-slate-800' : 'mt-3 max-w-2xl text-slate-200';
  const primaryClassName = useAmber
    ? 'rounded-sm bg-slate-950 px-5 py-3 font-bold text-white'
    : 'rounded-sm bg-amber-400 px-5 py-3 font-bold text-slate-950';
  const secondaryClassName = useAmber
    ? 'rounded-sm border border-slate-950 px-5 py-3 font-bold text-slate-950'
    : 'rounded-sm border border-white/40 px-5 py-3 font-bold text-white';

  return (
    <section className={sectionClassName}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className={titleClassName}>{title}</h2>
          <p className={`${subtitleClassName} ${tone === 'practical' ? 'leading-7' : ''}`}>{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="#contact" className={primaryClassName}>
            {primaryCtaLabel}
          </a>

          {secondaryCtaLabel && phone ? (
            <a href={'tel:' + phone} className={secondaryClassName}>
              {secondaryCtaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
