import type { NavItem, SimpleLink } from '../types';

export type SiteFooterBlockProps = {
  logoText: string;
  description?: string;
  phone?: string;
  email?: string;
  navItems: NavItem[];
  legalLinks: SimpleLink[];
};

export function SiteFooterBlock({
  logoText,
  description,
  phone,
  email,
  navItems,
  legalLinks,
}: SiteFooterBlockProps) {
  return (
    <footer className="bg-slate-950 px-6 py-12 text-white lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <div>
          <p className="text-xl font-bold">{logoText}</p>
          {description ? <p className="mt-3 text-sm text-slate-300">{description}</p> : null}
        </div>

        <div>
          <p className="font-semibold">Navigation</p>
          <nav className="mt-3 grid gap-2 text-sm text-slate-300">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        </div>

        <div>
          <p className="font-semibold">Contact</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            {phone ? <a href={'tel:' + phone}>{phone}</a> : null}
            {email ? <a href={'mailto:' + email}>{email}</a> : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
