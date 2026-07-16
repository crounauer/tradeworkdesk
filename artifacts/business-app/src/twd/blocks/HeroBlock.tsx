export type HeroBlockProps = {
  eyebrow?: string;
  layout?: 'full' | 'centered' | 'split';
  variant?: 'default' | 'classic' | 'modern';
  heroStyle?: 'default' | 'classic' | 'modern';
  tone?: 'default' | 'navy' | 'light';
  ctaStyle?: 'default' | 'rounded' | 'soft' | 'outline';
  density?: 'normal' | 'comfortable' | 'compact';
  title: string;
  headingAccent?: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  phone?: string;
  backgroundImageUrl?: string;
  backgroundCss?: string;
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
  primaryColor?: string;
  primaryTextColor?: string;
  mutedBackgroundColor?: string;
  mutedTextColor?: string;
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
  trustBadges?: string[];
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
  ctaStyle = 'default',
  density = 'normal',
  title,
  headingAccent,
  subtitle,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  phone,
  backgroundImageUrl,
  backgroundCss,
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
  primaryColor,
  primaryTextColor,
  mutedBackgroundColor,
  mutedTextColor,
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
  trustBadges,
}: HeroBlockProps) {
  const isSplit = layout === 'split';
  const isCentered = layout === 'centered';
  const isModern = variant === 'modern' || heroStyle === 'modern';
  const isClassic = variant === 'classic' || heroStyle === 'classic';
  const isNavyTone = tone === 'navy' || (tone === 'default' && isClassic);
  const accentToken = accentColor ?? '#00a8a8';
  const primaryToken = primaryColor ?? '#1a3a6b';
  const primaryTextToken = primaryTextColor ?? '#ffffff';
  const mutedBackgroundToken = mutedBackgroundColor ?? '#f8fafc';
  const mutedTextToken = mutedTextColor ?? '#475569';
  const bgColor = backgroundColor
    ?? (isModern && isSplit ? mutedBackgroundToken : undefined)
    ?? (isClassic && isSplit ? mutedBackgroundToken : undefined)
    ?? (isClassic || isNavyTone ? primaryToken : undefined)
    ?? (isSplit ? '#ffffff' : '#020617');
  const fgColor = textColor
    ?? (isModern && isSplit ? '#0f172a' : undefined)
    ?? (isClassic && isSplit ? '#0f172a' : undefined)
    ?? (isClassic || isNavyTone ? primaryTextToken : undefined)
    ?? (isSplit ? '#111827' : '#ffffff');
  const hasBackgroundImage = Boolean(backgroundImageUrl && !isSplit);
  const explicitBackground = typeof backgroundCss === 'string' && backgroundCss.trim() ? backgroundCss.trim() : undefined;
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
    color: subheadingColor ?? (isSplit ? mutedTextToken : (isNavyTone ? 'rgba(255,255,255,0.82)' : '#cbd5e1')),
    fontFamily: bodyFontFamily || fontFamily,
    fontSize: resolveSize(subheadingFontSize, '1.125rem'),
    fontWeight: resolveWeight(subheadingFontWeight, 400),
  } as const;
  const eyebrowStyle = {
    color: eyebrowColor ?? accentToken,
    fontFamily: bodyFontFamily || fontFamily,
    fontSize: resolveSize(eyebrowFontSize, '0.875rem'),
  } as const;
  const primaryRadiusDefault = ctaStyle === 'rounded' ? '999px' : ctaStyle === 'soft' ? '10px' : isClassic ? '2px' : '10px';
  const primaryButtonStyle = {
    backgroundColor: primaryButtonBgColor ?? (ctaStyle === 'outline' ? 'transparent' : accentToken),
    borderColor: primaryButtonBorderColor ?? accentToken,
    color: primaryButtonTextColor ?? (ctaStyle === 'outline' ? accentToken : '#ffffff'),
    borderRadius: resolveSize(primaryRadiusDefault, '10px'),
    borderWidth: ctaStyle === 'outline' ? '2px' : '1px',
    borderStyle: 'solid',
    fontFamily: ctaFontFamily || fontFamily,
    fontSize: resolveSize(ctaFontSize, '0.9375rem'),
    fontWeight: resolveWeight(ctaFontWeight, 700),
  } as const;
  const secondaryRadiusDefault = ctaStyle === 'rounded' ? '999px' : ctaStyle === 'soft' ? '10px' : isClassic ? '2px' : '10px';
  const secondaryButtonStyle = {
    backgroundColor: secondaryButtonBgColor ?? 'transparent',
    borderColor: secondaryButtonBorderColor ?? (isSplit ? '#d1d5db' : 'rgba(255,255,255,0.35)'),
    color: secondaryButtonTextColor ?? fgColor,
    borderRadius: resolveSize(secondaryRadiusDefault, '10px'),
    borderWidth: '1px',
    borderStyle: 'solid',
    fontFamily: ctaFontFamily || fontFamily,
    fontSize: resolveSize(ctaFontSize, '0.9375rem'),
    fontWeight: resolveWeight(ctaFontWeight, 700),
  } as const;
  const cardStyle = {
    backgroundColor: cardBackgroundColor ?? (isSplit ? '#ffffff' : 'rgba(255,255,255,0.08)'),
    borderColor: cardBorderColor ?? 'transparent',
    boxShadow: cardShadow ?? '0 20px 45px rgba(2,6,23,0.35)',
  } as const;

  const renderHeading = () => {
    if (headingAccent && title.includes(headingAccent)) {
      const parts = title.split(headingAccent);
      return (
        <h1 className={isSplit ? 'tracking-tight md:text-5xl' : 'tracking-tight md:text-6xl'} style={headingStyle}>
          {parts[0]}<span style={{ color: accentColor ?? '#f59e0b' }}>{headingAccent}</span>{parts.slice(1).join(headingAccent)}
        </h1>
      );
    }

    return (
      <h1 className={isSplit ? 'tracking-tight md:text-5xl' : 'tracking-tight md:text-6xl'} style={headingStyle}>
        {title}
      </h1>
    );
  };

  return (
    <section
      className="text-white"
      style={{
        background: explicitBackground,
        // Keep a solid fallback so the hero never renders as a white panel
        // if a complex background shorthand is rejected by the browser.
        backgroundColor: bgColor,
        color: fgColor,
        backgroundImage: explicitBackground ? undefined : hasBackgroundImage ? `linear-gradient(${overlay}, ${overlay}), url(${backgroundImageUrl})` : undefined,
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
              {eyebrow ? (
                <p className={eyebrowClassName}>
                  <span style={eyebrowStyle}>{eyebrow}</span>
                </p>
              ) : null}
              {renderHeading()}
              <p className="mt-6 max-w-xl" style={subheadingStyle}>
                {subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-start">
                <a href={primaryCtaHref || '#contact'} className={primaryCtaClassName} style={primaryButtonStyle}>
                  {primaryCtaLabel}
                </a>
                {secondaryCtaLabel ? (
                  <a href={secondaryCtaHref || '#services'} className={secondarySplitClassName} style={secondaryButtonStyle}>
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
            {eyebrow ? (
              <p className={eyebrowClassName}>
                <span style={eyebrowStyle}>{eyebrow}</span>
              </p>
            ) : null}
            {renderHeading()}
            <p className="mt-6 max-w-2xl" style={subheadingStyle}>
              {subtitle}
            </p>
            <div className={`mt-8 flex flex-wrap gap-4 ${isCentered ? 'justify-center' : 'justify-start'}`}>
              <a href={primaryCtaHref || '#contact'} className={primaryCtaClassName} style={primaryButtonStyle}>
                {primaryCtaLabel}
              </a>
              {secondaryCtaLabel ? (
                <a href={secondaryCtaHref || '#services'} className={secondaryFullClassName} style={secondaryButtonStyle}>
                  {secondaryCtaLabel}
                </a>
              ) : null}
            </div>
            {trustBadges && trustBadges.length > 0 ? (
              <div className={`mt-8 flex flex-wrap gap-3 ${isCentered ? 'justify-center' : 'justify-start'}`}>
                {trustBadges.map((badge) => (
                  <span key={badge} className="inline-flex items-center gap-1.5 text-sm" style={{ color: subheadingStyle.color }}>
                    <span style={{ color: accentToken }}>✓</span>
                    <span>{badge.replace(/^\S+\s+/, '') || badge}</span>
                  </span>
                ))}
              </div>
            ) : null}
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
