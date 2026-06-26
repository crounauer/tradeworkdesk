import type { BadgeItem } from '../types';

export type TrustBadgesBlockProps = {
  badges: BadgeItem[];
};

export function TrustBadgesBlock({ badges }: TrustBadgesBlockProps) {
  return (
    <section className="bg-slate-50 px-6 py-10 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
        {badges.map((badge) => (
          <div key={badge.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="font-bold text-slate-950">{badge.label}</p>
            <p className="mt-2 text-sm text-slate-600">{badge.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
