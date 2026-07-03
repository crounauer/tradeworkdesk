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
  fontFamily?: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  ctaFontFamily?: string;
  headingFontSize?: string;
  subheadingFontSize?: string;
  eyebrowFontSize?: string;
  ctaFontSize?: string;
  headingFontWeight?: string | number;
  subheadingFontWeight?: string | number;
  ctaFontWeight?: string | number;
  sectionPaddingTop?: string;
  sectionPaddingBottom?: string;
  contentMaxWidth?: string;
  contentGap?: string;
  sectionBorderRadius?: string;
  sectionBorderWidth?: string;
  sectionBorderColor?: string;
  sectionShadow?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  accentColor?: string;
  headingColor?: string;
  subheadingColor?: string;
  eyebrowColor?: string;
  primaryButtonBgColor?: string;
  primaryButtonTextColor?: string;
  primaryButtonBorderColor?: string;
  secondaryButtonBgColor?: string;
  secondaryButtonTextColor?: string;
  secondaryButtonBorderColor?: string;
  cardBackgroundColor?: string;
  cardBorderColor?: string;
  cardShadow?: string;
};

function resolveSize(value: string | number | undefined, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function resolveWeight(value: string | number | undefined, fallback: number): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

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
  fontFamily,
  headingFontFamily,
  bodyFontFamily,
  ctaFontFamily,
  headingFontSize,
  subheadingFontSize,
  eyebrowFontSize,
  ctaFontSize,
  headingFontWeight,
  subheadingFontWeight,
  ctaFontWeight,
  sectionPaddingTop: sectionPaddingTopProp,
  sectionPaddingBottom: sectionPaddingBottomProp,
  contentMaxWidth: contentMaxWidthProp,
  contentGap: contentGapProp,
  sectionBorderRadius: sectionBorderRadiusProp,
  sectionBorderWidth: sectionBorderWidthProp,
  sectionBorderColor: sectionBorderColorProp,
  sectionShadow: sectionShadowProp,
  overlayColor: overlayColorProp,
  overlayOpacity,
  accentColor,
  headingColor,
  subheadingColor,
  eyebrowColor,
  primaryButtonBgColor,
  primaryButtonTextColor,
  primaryButtonBorderColor,
  secondaryButtonBgColor,
  secondaryButtonTextColor,
  secondaryButtonBorderColor,
  cardBackgroundColor,
  cardBorderColor,
  cardShadow,
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
  const sectionPaddingTop = resolveSize(sectionPaddingTopProp, density === 'compact' ? '56px' : density === 'comfortable' ? '96px' : '80px');
  const sectionPaddingBottom = resolveSize(sectionPaddingBottomProp, density === 'compact' ? '48px' : density === 'comfortable' ? '72px' : '64px');
  const contentMaxWidth = resolveSize(contentMaxWidthProp, '1200px');
  const contentGap = resolveSize(contentGapProp, '40px');
  const sectionBorderRadius = resolveSize(sectionBorderRadiusProp, '0px');
  const sectionBorderWidth = resolveSize(sectionBorderWidthProp, '0px');
  const sectionBorderColor = sectionBorderColorProp || 'transparent';
  const sectionShadow = sectionShadowProp;
  const overlayBase = typeof overlayColorProp === 'string' && overlayColorProp.trim() ? overlayColorProp.trim() : '0,0,0';
  const overlay = overlayBase.startsWith('rgb') || overlayBase.startsWith('#') ? overlayBase : `rgba(${overlayBase}, ${overlayOpacity ?? 0.55})`;
  const headingStyle = {
    color: headingColor ?? fgColor,
    fontFamily: headingFontFamily || fontFamily,
    fontSize: resolveSize(headingFontSize, isCentered ? 'clamp(2rem, 4.8vw, 3.5rem)' : 'clamp(2rem, 4.8vw, 3.5rem)'),
    fontWeight: resolveWeight(headingFontWeight, 800),
  } as const;
  const subheadingStyle = {
    color: subheadingColor ?? (isSplit ? (isClassic ? '#334155' : '#4b5563') : '#cbd5e1'),
    fontFamily: bodyFontFamily || fontFamily,
    fontSize: resolveSize(subheadingFontSize, '1.125rem'),
    fontWeight: resolveWeight(subheadingFontWeight, 400),
  } as const;
  const eyebrowStyle = {
    color: eyebrowColor ?? (isClassic ? '#fcd34d' : '#f59e0b'),
    fontFamily: bodyFontFamily || fontFamily,
    fontSize: resolveSize(eyebrowFontSize, '0.875rem'),
  } as const;
  const primaryButtonStyle = {
    backgroundColor: primaryButtonBgColor ?? '#f59e0b',
    borderColor: primaryButtonBorderColor ?? '#f59e0b',
    color: primaryButtonTextColor ?? '#0f172a',
    borderRadius: isClassic ? '2px' : '10px',
    fontFamily: ctaFontFamily || fontFamily,
    fontSize: resolveSize(ctaFontSize, '0.9375rem'),
    fontWeight: resolveWeight(ctaFontWeight, 700),
  } as const;
  const secondaryButtonStyle = {
    backgroundColor: secondaryButtonBgColor ?? 'transparent',
    borderColor: secondaryButtonBorderColor ?? '#d1d5db',
    color: secondaryButtonTextColor ?? 'inherit',
    borderRadius: isClassic ? '2px' : '10px',
    fontFamily: ctaFontFamily || fontFamily,
    fontSize: resolveSize(ctaFontSize, '0.9375rem'),
    fontWeight: resolveWeight(ctaFontWeight, 700),
  } as const;
  const cardStyle = {
    backgroundColor: cardBackgroundColor ?? (isSplit ? '#ffffff' : 'rgba(255,255,255,0.08)'),
    borderColor: cardBorderColor ?? 'transparent',
    boxShadow: cardShadow ?? '0 20px 45px rgba(2,6,23,0.35)',
  } as const;

  return (
    <section
      className="text-white"
      style={{
        backgroundColor: bgColor,
        color: fgColor,
        backgroundImage: hasBackgroundImage ? `linear-gradient(${overlay}, ${overlay}), url(${backgroundImageUrl})` : undefined,
        backgroundSize: hasBackgroundImage ? 'cover' : undefined,
        backgroundPosition: hasBackgroundImage ? 'center' : undefined,
        backgroundRepeat: hasBackgroundImage ? 'no-repeat' : undefined,
        paddingTop: sectionPaddingTop,
        paddingBottom: sectionPaddingBottom,
        borderRadius: sectionBorderRadius,
        border: `${sectionBorderWidth} solid ${sectionBorderColor}`,
        boxShadow: sectionShadow,
        fontFamily: bodyFontFamily || fontFamily,
      }}
    >
      <div className={`mx-auto px-6 lg:px-8`} style={{ maxWidth: contentMaxWidth }}>
        {layout === 'split' ? (
          <div className="grid md:grid-cols-2 md:items-center" style={{ gap: contentGap }}>
            <div className={isCentered ? 'text-center' : 'text-left'}>
              <p className={eyebrowClassName}>
                <span style={eyebrowStyle}>{eyebrow}</span>
              </p>
              <h1 className="tracking-tight md:text-5xl" style={headingStyle}>
                {title}
              </h1>
              <p className="mt-6 max-w-xl" style={subheadingStyle}>
                {subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-start">
                <a href="#contact" className={primaryCtaClassName} style={primaryButtonStyle}>
                  {primaryCtaLabel}
                </a>
                {secondaryCtaLabel ? (
                  <a href="#services" className={secondarySplitClassName} style={secondaryButtonStyle}>
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
            <div className={splitImageWrapperClassName} style={cardStyle}>
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
              <span style={eyebrowStyle}>{eyebrow}</span>
            </p>
            <h1 className="tracking-tight md:text-6xl" style={headingStyle}>
              {title}
            </h1>
            <p className="mt-6 max-w-2xl" style={subheadingStyle}>
              {subtitle}
            </p>
            <div className={`mt-8 flex flex-wrap gap-4 ${isCentered ? 'justify-center' : 'justify-start'}`}>
              <a href="#contact" className={primaryCtaClassName} style={primaryButtonStyle}>
                {primaryCtaLabel}
              </a>
              {secondaryCtaLabel ? (
                <a href="#services" className={secondaryFullClassName} style={secondaryButtonStyle}>
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
