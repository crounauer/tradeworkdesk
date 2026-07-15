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
  const useAmber = background === 'amber' || (background === 'default' && ctaStyle !== 'classic-navy');
  const sectionClassName = useAmber
    ? 'bg-amber-400 px-6 py-16 lg:px-8'
    : 'bg-[#1a3a6b] px-6 py-16 text-white lg:px-8';
  const titleClassName = useAmber ? 'text-3xl font-bold tracking-tight text-slate-950' : 'text-3xl font-bold tracking-tight text-white';
  const subtitleClassName = useAmber ? 'mt-3 max-w-2xl text-slate-800' : 'mt-3 max-w-2xl text-slate-200';
  const primaryClassName = useAmber
    ? 'rounded-sm bg-slate-950 px-5 py-3 font-bold text-white'
    : 'rounded-[10px] border border-[rgba(26,58,107,0.12)] bg-[#00a8a8] px-5 py-3 font-bold text-white';
  const secondaryClassName = useAmber
    ? 'rounded-sm border border-slate-950 px-5 py-3 font-bold text-slate-950'
    : 'rounded-[10px] border border-[rgba(26,58,107,0.12)] bg-white px-5 py-3 font-bold text-[#1a3a6b]';

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
