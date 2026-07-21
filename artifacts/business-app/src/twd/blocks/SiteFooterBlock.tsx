import type { NavItem, SimpleLink } from '../types';

export type SiteFooterBlockProps = {
  logoText: string;
  description?: string;
  phone?: string;
  email?: string;
  navItems?: NavItem[];
  nav_items?: NavItem[];
  legalLinks?: SimpleLink[];
  legal_links?: SimpleLink[];
  variant?: 'default' | 'classic';
  layout?: 'default' | 'traditional' | 'four-column' | 'compact-inline' | 'centered-stack' | 'minimal-columns' | 'split-brand';
  layout_variant?: 'four-column' | 'compact-inline' | 'centered-stack' | 'minimal-columns' | 'split-brand';
  background?: 'default' | 'navy';
  background_color?: string;
  text_color?: string;
  heading_color?: string;
  border_color?: string;
  tone?: 'default' | 'formal';
};

export function SiteFooterBlock({
  logoText,
  description,
  phone,
  email,
  navItems,
  nav_items,
  legalLinks,
  legal_links,
  variant = 'default',
  layout = 'default',
  layout_variant,
  background = 'default',
  background_color,
  text_color,
  heading_color,
  border_color,
  tone = 'default',
}: SiteFooterBlockProps) {
  const isClassic = variant === 'classic';
  const rawLayout = String(layout_variant || layout || 'four-column').toLowerCase();
  const normalizedLayout = rawLayout === 'default'
    ? 'four-column'
    : rawLayout === 'traditional'
      ? 'minimal-columns'
      : rawLayout === 'split-brand'
        ? 'compact-inline'
        : rawLayout;
  const isTraditional = normalizedLayout === 'minimal-columns';
  const useNavy = background === 'navy' || isClassic;
  const resolvedBackground = background_color && background_color !== 'default'
    ? background_color
    : '#0f172a';
  const resolvedTextColor = text_color && text_color !== 'default'
    ? text_color
    : '#cbd5e1';
  const resolvedHeadingColor = heading_color || '#ffffff';
  const resolvedBorderColor = border_color && border_color !== 'default'
    ? border_color
    : 'rgba(255,255,255,0.12)';
  const sectionClassName = useNavy
    ? 'px-6 py-12 text-white lg:px-8'
    : 'px-6 py-12 text-white lg:px-8';
  const gridClassName = isTraditional
    ? 'mx-auto grid max-w-7xl gap-8 md:grid-cols-4'
    : 'mx-auto grid max-w-7xl gap-8 md:grid-cols-3';
  const navEntries = (Array.isArray(navItems) ? navItems : Array.isArray(nav_items) ? nav_items : []).filter(Boolean);
  const legalEntries = (Array.isArray(legalLinks) ? legalLinks : Array.isArray(legal_links) ? legal_links : []).filter(Boolean);
  const links = navEntries.filter((item) => item.label || item.href);

  return (
    <footer className={sectionClassName} style={{ background: resolvedBackground, color: resolvedTextColor }}>
      {normalizedLayout === 'centered-stack' ? (
        <div className="mx-auto grid max-w-4xl gap-3 text-center">
          <p className="text-xl font-bold" style={{ color: resolvedHeadingColor }}>{logoText}</p>
          {description ? <p className={`text-sm ${tone === 'formal' ? 'leading-7' : ''}`}>{description}</p> : null}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-sm">
            {links.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </div>
          <div className="mt-1 grid gap-1 text-sm">
            {phone ? <a href={'tel:' + phone}>{phone}</a> : null}
            {email ? <a href={'mailto:' + email}>{email}</a> : null}
          </div>
        </div>
      ) : normalizedLayout === 'compact-inline' ? (
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xl font-bold" style={{ color: resolvedHeadingColor }}>{logoText}</p>
            {description ? <p className={`mt-2 text-sm ${tone === 'formal' ? 'leading-7' : ''}`}>{description}</p> : null}
          </div>
          <div>
            <p className="font-semibold" style={{ color: resolvedHeadingColor }}>Links</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {links.map((item) => (
                <a key={item.href} href={item.href}>{item.label}</a>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold" style={{ color: resolvedHeadingColor }}>Contact</p>
            <div className="mt-2 grid gap-1 text-sm">
              {phone ? <a href={'tel:' + phone}>{phone}</a> : null}
              {email ? <a href={'mailto:' + email}>{email}</a> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className={gridClassName}>
        <div>
          <p className="text-xl font-bold" style={{ color: resolvedHeadingColor }}>{logoText}</p>
          {description ? <p className={`mt-3 text-sm ${tone === 'formal' ? 'leading-7' : ''}`}>{description}</p> : null}
        </div>

        <div>
          <p className="font-semibold" style={{ color: resolvedHeadingColor }}>Services & Pages</p>
          <nav className="mt-3 grid gap-2 text-sm">
            {links.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        </div>

        {isTraditional ? (
          <div>
            <p className="font-semibold" style={{ color: resolvedHeadingColor }}>Areas</p>
            <div className="mt-3 grid gap-2 text-sm">
              <span>Aberdeen</span>
              <span>Ellon</span>
              <span>Inverurie</span>
            </div>
          </div>
        ) : null}

        <div>
          <p className="font-semibold" style={{ color: resolvedHeadingColor }}>Contact</p>
          <div className="mt-3 grid gap-2 text-sm">
            {phone ? <a href={'tel:' + phone}>{phone}</a> : null}
            {email ? <a href={'mailto:' + email}>{email}</a> : null}
          </div>
        </div>
      </div>
      )}

      <div className="mx-auto mt-6 max-w-7xl border-t pt-3 text-xs" style={{ borderColor: resolvedBorderColor }}>
        <div className="flex flex-wrap items-center gap-3">
          {legalEntries.map((item) => (
            <a key={`footer-bottom-legal-${item.href}`} href={item.href}>{item.label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
