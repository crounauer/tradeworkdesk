import type { ServiceRateItem } from '../types';

export type ServiceRatesBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  note?: string;
  rates: ServiceRateItem[];
  variation?: 'cards' | 'table' | 'split' | 'compact';
  background?: 'default' | 'white' | 'light';
};

export function ServiceRatesBlock({
  eyebrow = 'Rates',
  title,
  subtitle,
  note,
  rates,
  variation = 'cards',
  background = 'default',
}: ServiceRatesBlockProps) {
  const sectionClassName = background === 'light'
    ? 'bg-[#f0f4f9] px-6 py-20 lg:px-8'
    : background === 'white'
      ? 'bg-white px-6 py-20 lg:px-8'
      : 'bg-white px-6 py-20 lg:px-8';

  const baseCardClassName = 'rounded-sm border border-slate-300 bg-white p-6';
  const featuredCardClassName = 'rounded-sm border-2 border-[#1a3a6b] bg-white p-6 shadow-sm';

  return (
    <section id="rates" className={sectionClassName}>
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a6b]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 text-lg text-slate-600">{subtitle}</p> : null}
        </div>

        {variation === 'cards' ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rates.map((rate) => (
              <article key={rate.service} className={rate.badge ? featuredCardClassName : baseCardClassName}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-950">{rate.service}</h3>
                  <p className="text-lg font-bold text-[#1a3a6b]">{rate.price}</p>
                </div>
                {rate.badge ? (
                  <span className="mt-3 inline-block rounded-sm bg-[#1a3a6b] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    {rate.badge}
                  </span>
                ) : null}
                {rate.description ? <p className="mt-3 text-slate-600">{rate.description}</p> : null}
                {rate.duration ? <p className="mt-2 text-sm font-medium text-slate-500">Typical duration: {rate.duration}</p> : null}
                {rate.ctaLabel && rate.ctaHref ? (
                  <a href={rate.ctaHref} className="mt-4 inline-block font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4">
                    {rate.ctaLabel} {'->'}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {variation === 'table' ? (
          <div className="mt-10 overflow-hidden rounded-sm border border-slate-300 bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Service</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Rate</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Duration</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.service} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">{rate.service}</td>
                    <td className="px-4 py-4 text-sm font-bold text-[#1a3a6b]">{rate.price}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{rate.duration || '-'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {rate.description || '-'}
                      {rate.ctaLabel && rate.ctaHref ? (
                        <div>
                          <a href={rate.ctaHref} className="mt-2 inline-block font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4">
                            {rate.ctaLabel} {'->'}
                          </a>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {variation === 'split' ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr,1.9fr]">
            <article className={featuredCardClassName}>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#1a3a6b]">Featured rate</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-950">{rates[0]?.service || 'Service'}</h3>
              <p className="mt-2 text-3xl font-extrabold text-[#1a3a6b]">{rates[0]?.price || 'From £0'}</p>
              {rates[0]?.description ? <p className="mt-3 text-slate-600">{rates[0].description}</p> : null}
              {rates[0]?.duration ? <p className="mt-3 text-sm font-medium text-slate-500">Typical duration: {rates[0].duration}</p> : null}
              {rates[0]?.ctaLabel && rates[0]?.ctaHref ? (
                <a href={rates[0].ctaHref} className="mt-4 inline-block font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4">
                  {rates[0].ctaLabel} {'->'}
                </a>
              ) : null}
            </article>
            <div className="grid gap-4 md:grid-cols-2">
              {rates.slice(1).map((rate) => (
                <article key={rate.service} className={baseCardClassName}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-950">{rate.service}</h3>
                    <p className="text-base font-bold text-[#1a3a6b]">{rate.price}</p>
                  </div>
                  {rate.description ? <p className="mt-3 text-sm text-slate-600">{rate.description}</p> : null}
                  {rate.duration ? <p className="mt-2 text-xs font-medium text-slate-500">{rate.duration}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {variation === 'compact' ? (
          <div className="mt-10 overflow-hidden rounded-sm border border-slate-300 bg-white">
            {rates.map((rate, index) => (
              <article
                key={rate.service}
                className={`flex flex-wrap items-start justify-between gap-3 px-4 py-4 ${index > 0 ? 'border-t border-slate-200' : ''}`}
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{rate.service}</h3>
                  {rate.description ? <p className="mt-1 text-sm text-slate-600">{rate.description}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-[#1a3a6b]">{rate.price}</p>
                  {rate.duration ? <p className="mt-1 text-xs text-slate-500">{rate.duration}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {note ? <p className="mt-5 text-sm text-slate-500">{note}</p> : null}
      </div>
    </section>
  );
}
