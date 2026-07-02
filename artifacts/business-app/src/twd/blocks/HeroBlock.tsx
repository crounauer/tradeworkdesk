export type HeroBlockProps = {
  eyebrow?: string;
  layout?: 'full' | 'centered' | 'split';
  variant?: 'default' | 'classic';
  heroStyle?: 'default' | 'classic';
  tone?: 'default' | 'navy';
  density?: 'normal' | 'comfortable' | 'compact';
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  phone?: string;
  backgroundImageUrl?: string;
  heroImageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  imageAlt?: string;
};

export function HeroBlock({
  eyebrow = 'Local trade specialists',
  layout = 'full',
  variant = 'default',
  heroStyle = 'default',
  tone = 'default',
  density = 'normal',
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  phone,
  backgroundImageUrl,
  heroImageUrl,
  backgroundColor,
  textColor,
  imageAlt = 'Trade business image placeholder',
}: HeroBlockProps) {
  const isSplit = layout === 'split';
  const isCentered = layout === 'centered';
  const isClassic = variant === 'classic' || heroStyle === 'classic';
  const isNavyTone = tone === 'navy';
  const bgColor = backgroundColor
    ?? (isClassic && isSplit ? '#f8fafc' : undefined)
    ?? (isClassic || isNavyTone ? '#0f2448' : undefined)
    ?? (isSplit ? '#ffffff' : '#020617');
  const fgColor = textColor
    ?? (isClassic && isSplit ? '#0f172a' : undefined)
    ?? (isClassic || isNavyTone ? '#f8fafc' : undefined)
    ?? (isSplit ? '#111827' : '#ffffff');
  const hasBackgroundImage = Boolean(backgroundImageUrl && !isSplit);
  const sectionPaddingClass = density === 'compact' ? 'py-14' : density === 'comfortable' ? 'py-24' : 'py-20';
  const eyebrowClassName = isClassic ? 'mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-amber-300' : 'mb-4 text-sm font-semibold uppercase tracking-wide text-amber-400';
  const primaryCtaClassName = isClassic
    ? 'rounded-sm bg-amber-400 px-5 py-3 font-semibold text-slate-950'
    : 'rounded-md bg-amber-400 px-5 py-3 font-semibold text-slate-950';
  const secondarySplitClassName = isClassic
    ? 'rounded-sm border border-slate-300 px-5 py-3 font-semibold text-inherit'
    : 'rounded-md border border-slate-300 px-5 py-3 font-semibold text-inherit';
  const secondaryFullClassName = isClassic
    ? 'rounded-sm border border-white/40 px-5 py-3 font-semibold text-white'
    : 'rounded-md border border-white/30 px-5 py-3 font-semibold text-white';
  const splitImageWrapperClassName = isClassic
    ? 'rounded-sm border border-slate-200 bg-white p-6 shadow-lg'
    : 'rounded-2xl bg-slate-800 p-6 shadow-xl';
  const splitImageFrameClassName = isClassic
    ? 'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm bg-slate-100 text-center text-sm text-slate-500'
    : 'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-700 text-center text-sm text-slate-300';

  return (
    <section
      className="text-white"
      style={{
        backgroundColor: bgColor,
        color: fgColor,
        backgroundImage: hasBackgroundImage ? `linear-gradient(rgba(2, 6, 23, 0.18), rgba(2, 6, 23, 0.18)), url(${backgroundImageUrl})` : undefined,
        backgroundSize: hasBackgroundImage ? 'cover' : undefined,
        backgroundPosition: hasBackgroundImage ? 'center' : undefined,
        backgroundRepeat: hasBackgroundImage ? 'no-repeat' : undefined,
      }}
    >
      <div className={`mx-auto max-w-7xl px-6 ${sectionPaddingClass} lg:px-8`}>
        {layout === 'split' ? (
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className={isCentered ? 'text-center' : 'text-left'}>
              <p className={eyebrowClassName}>
                {eyebrow}
              </p>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ color: fgColor }}>
                {title}
              </h1>
              <p className="mt-6 max-w-xl text-lg" style={{ color: isSplit ? (isClassic ? '#334155' : '#4b5563') : '#cbd5e1' }}>
                {subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-start">
                <a href="#contact" className={primaryCtaClassName}>
                  {primaryCtaLabel}
                </a>
                {secondaryCtaLabel ? (
                  <a href="#services" className={secondarySplitClassName}>
                    {secondaryCtaLabel}
                  </a>
                ) : null}
              </div>
              {phone ? (
                <p className="mt-6 text-sm" style={{ color: isSplit ? '#6b7280' : '#cbd5e1' }}>
                  Prefer to call? <span className="font-semibold" style={{ color: fgColor }}>{phone}</span>
                </p>
              ) : null}
            </div>
            <div className={splitImageWrapperClassName}>
              <div className={splitImageFrameClassName}>
                {heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImageUrl} alt={imageAlt} className="h-full w-full object-cover" />
                ) : (
                  imageAlt
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={isCentered ? 'mx-auto max-w-4xl text-center' : 'max-w-4xl'}>
            <p className={eyebrowClassName}>
              {eyebrow}
            </p>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl" style={{ color: fgColor }}>
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg" style={{ color: isSplit ? '#4b5563' : '#cbd5e1' }}>
              {subtitle}
            </p>
            <div className={`mt-8 flex flex-wrap gap-4 ${isCentered ? 'justify-center' : 'justify-start'}`}>
              <a href="#contact" className={primaryCtaClassName}>
                {primaryCtaLabel}
              </a>
              {secondaryCtaLabel ? (
                <a href="#services" className={secondaryFullClassName}>
                  {secondaryCtaLabel}
                </a>
              ) : null}
            </div>
            {phone ? (
              <p className="mt-6 text-sm" style={{ color: isSplit ? '#6b7280' : '#cbd5e1' }}>
                Prefer to call? <span className="font-semibold" style={{ color: fgColor }}>{phone}</span>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
