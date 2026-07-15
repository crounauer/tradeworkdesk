import type { NavItem } from '../types';

export type SiteHeaderBlockProps = {
  logoText: string;
  navItems: NavItem[];
  phone?: string;
  ctaLabel?: string;
  ctaHref?: string;
  layout?: 'default' | 'traditional';
  headerStyle?: 'light' | 'classic-dark';
  tone?: 'default' | 'navy';
  ctaStyle?: 'default' | 'amber-solid' | 'outline-light';
  variant?: 'default' | 'figma';
  scheduleText?: string;
  locationText?: string;
};

export function SiteHeaderBlock({
  logoText,
  navItems,
  phone,
  ctaLabel,
  ctaHref = '#contact',
  layout = 'default',
  headerStyle = 'light',
  tone = 'default',
  ctaStyle = 'default',
  variant = 'default',
  scheduleText,
  locationText,
}: SiteHeaderBlockProps) {
  const isClassicDark = headerStyle === 'classic-dark' || tone === 'navy';
  const isTraditional = layout === 'traditional';
  const headerClassName = isClassicDark
    ? 'border-b border-slate-800 bg-slate-950 text-white'
    : 'border-b border-slate-200 bg-white';
  const logoClassName = isClassicDark
    ? 'text-xl font-bold tracking-tight text-white'
    : 'text-xl font-bold tracking-tight text-slate-950';
  const navClassName = isClassicDark
    ? 'flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-200'
    : 'flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-700';
  const navHoverClassName = isClassicDark ? 'hover:text-amber-300' : 'hover:text-slate-950';
  const phoneClassName = isClassicDark ? 'text-sm font-semibold text-amber-300' : 'text-sm font-semibold text-slate-700';
  const ctaClassName = ctaStyle === 'outline-light'
    ? 'rounded-sm border border-white/50 px-4 py-2 text-sm font-bold text-white'
    : isClassicDark || ctaStyle === 'amber-solid' || ctaStyle === 'default'
      ? 'rounded-sm bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950'
      : 'rounded-md bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950';

  if (variant === 'figma') {
    return (
      <header className="border-b border-slate-200 bg-white">
        <div className="bg-[rgba(15,31,61,0.95)] text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-xs font-medium lg:px-8">
            <div className="flex items-center gap-4 text-white/90">
              {scheduleText ? <span>{scheduleText}</span> : null}
              {locationText ? <span>{locationText}</span> : null}
            </div>
            {phone ? (
              <a href={'tel:' + phone.replace(/\s+/g, '')} className="font-bold text-white">
                {phone}
              </a>
            ) : null}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <a href="/" className="text-2xl font-extrabold tracking-tight text-slate-950">
            {logoText}
          </a>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-700">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-slate-950">
                {item.label}
              </a>
            ))}
          </nav>

          {ctaLabel ? (
            <a
              href={ctaHref}
              className="rounded-[10px] border border-[rgba(26,58,107,0.12)] bg-[#00a8a8] px-4 py-2 text-[14px] font-bold leading-5 text-white hover:brightness-95"
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </header>
    );
  }

  if (isTraditional) {
    return (
      <header className={headerClassName}>
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
          <div className="flex flex-col gap-4 lg:gap-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <a href="/" className={logoClassName}>
                {logoText}
              </a>

              <div className="flex flex-wrap items-center gap-4">
                {phone ? (
                  <a href={'tel:' + phone} className={phoneClassName}>
                    {phone}
                  </a>
                ) : null}

                {ctaLabel ? (
                  <a href={ctaHref} className={ctaClassName}>
                    {ctaLabel}
                  </a>
                ) : null}
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-200 pt-3 text-sm font-medium text-slate-700">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className={navHoverClassName}>
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-6">
          <a href="/" className={logoClassName}>
            {logoText}
          </a>

          {phone ? (
            <a href={'tel:' + phone} className={`${phoneClassName} lg:hidden`}>
              {phone}
            </a>
          ) : null}
        </div>

        <nav className={navClassName}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={navHoverClassName}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {phone ? (
            <a href={'tel:' + phone} className={`${phoneClassName} hidden lg:inline`}>
              {phone}
            </a>
          ) : null}

          {ctaLabel ? (
            <a href={ctaHref} className={ctaClassName}>
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
