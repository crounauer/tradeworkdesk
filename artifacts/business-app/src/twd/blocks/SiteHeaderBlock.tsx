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

  return (
    <header className={headerClassName}>
      <div className={`mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:px-8 ${isTraditional ? 'lg:flex-row lg:items-center lg:justify-between' : 'lg:flex-row lg:items-center lg:justify-between'}`}>
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
