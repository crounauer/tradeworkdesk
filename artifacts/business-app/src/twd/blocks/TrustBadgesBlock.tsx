import type { BadgeItem } from '../types';

export type TrustBadgesBlockProps = {
  badges: BadgeItem[];
  variant?: 'default' | 'classic';
  background?: 'default' | 'white' | 'light';
  cardStyle?: 'default' | 'bordered-traditional';
  density?: 'normal' | 'compact';
};

export function TrustBadgesBlock({
  badges,
  variant = 'default',
  background = 'default',
  cardStyle = 'default',
  density = 'normal',
}: TrustBadgesBlockProps) {
  const isClassic = variant === 'classic';
  const sectionClassName = background === 'white'
    ? 'bg-white px-6 py-10 lg:px-8'
    : background === 'light'
      ? 'bg-slate-100 px-6 py-10 lg:px-8'
      : 'bg-slate-50 px-6 py-10 lg:px-8';
  const gridClassName = density === 'compact'
    ? 'mx-auto grid max-w-7xl gap-3 md:grid-cols-3'
    : 'mx-auto grid max-w-7xl gap-4 md:grid-cols-3';
  const cardClassName = cardStyle === 'bordered-traditional' || isClassic
    ? 'rounded-sm border border-slate-300 bg-white p-5'
    : 'rounded-xl border border-slate-200 bg-white p-5';

  return (
    <section className={sectionClassName}>
      <div className={gridClassName}>
        {badges.map((badge) => (
          <div key={badge.label} className={cardClassName}>
            <p className="font-bold text-slate-950">{badge.label}</p>
            <p className="mt-2 text-sm text-slate-600">{badge.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
