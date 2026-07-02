import type { NavItem, SimpleLink } from '../types';

export type SiteFooterBlockProps = {
  logoText: string;
  description?: string;
  phone?: string;
  email?: string;
  navItems: NavItem[];
  legalLinks: SimpleLink[];
  variant?: 'default' | 'classic';
  layout?: 'default' | 'traditional';
  background?: 'default' | 'navy';
  tone?: 'default' | 'formal';
};

export function SiteFooterBlock({
  logoText,
  description,
  phone,
  email,
  navItems,
  legalLinks,
  variant = 'default',
  layout = 'default',
  background = 'default',
  tone = 'default',
}: SiteFooterBlockProps) {
  const isClassic = variant === 'classic';
  const isTraditional = layout === 'traditional';
  const useNavy = background === 'navy' || isClassic;
  const sectionClassName = useNavy
    ? 'bg-slate-950 px-6 py-12 text-white lg:px-8'
    : 'bg-slate-950 px-6 py-12 text-white lg:px-8';
  const gridClassName = isTraditional
    ? 'mx-auto grid max-w-7xl gap-8 md:grid-cols-4'
    : 'mx-auto grid max-w-7xl gap-8 md:grid-cols-3';

  return (
    <footer className={sectionClassName}>
      <div className={gridClassName}>
        <div>
          <p className="text-xl font-bold">{logoText}</p>
          {description ? <p className={`mt-3 text-sm text-slate-300 ${tone === 'formal' ? 'leading-7' : ''}`}>{description}</p> : null}
        </div>

        <div>
          <p className="font-semibold">Services & Pages</p>
          <nav className="mt-3 grid gap-2 text-sm text-slate-300">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        </div>

        {isTraditional ? (
          <div>
            <p className="font-semibold">Areas</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <span>Aberdeen</span>
              <span>Ellon</span>
              <span>Inverurie</span>
            </div>
          </div>
        ) : null}

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
