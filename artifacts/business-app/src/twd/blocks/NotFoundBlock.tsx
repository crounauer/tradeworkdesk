export type NotFoundBlockProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
};

export function NotFoundBlock({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: NotFoundBlockProps) {
  return (
    <section className="flex min-h-[70vh] items-center bg-slate-950 px-6 py-20 text-white lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">404</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-5 text-lg text-slate-300">{subtitle}</p>
        <a href={ctaHref} className="mt-8 inline-block rounded-md bg-amber-400 px-5 py-3 font-bold text-slate-950">
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
