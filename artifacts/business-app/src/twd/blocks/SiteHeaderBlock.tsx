import type { NavItem } from '../types';

export type SiteHeaderBlockProps = {
  logoText: string;
  navItems: NavItem[];
  phone?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function SiteHeaderBlock({
  logoText,
  navItems,
  phone,
  ctaLabel,
  ctaHref = '#contact',
}: SiteHeaderBlockProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-6">
          <a href="/" className="text-xl font-bold tracking-tight text-slate-950">
            {logoText}
          </a>

          {phone ? (
            <a href={'tel:' + phone} className="text-sm font-semibold text-slate-700 lg:hidden">
              {phone}
            </a>
          ) : null}
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-700">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-slate-950">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {phone ? (
            <a href={'tel:' + phone} className="hidden text-sm font-semibold text-slate-700 lg:inline">
              {phone}
            </a>
          ) : null}

          {ctaLabel ? (
            <a href={ctaHref} className="rounded-md bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
