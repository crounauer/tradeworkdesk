import type { BusinessContent, HeroContent } from "@/features/website-builder/websiteBuilderTypes";

function looksUkBased(business: BusinessContent): boolean {
  const postcodePattern = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
  const hasUkDomain = /\.uk\b/i.test(business.email);
  const hasUkCountry = /\b(uk|united kingdom|great britain|england|scotland|wales|northern ireland)\b/i.test(
    business.address,
  );
  const hasUkPhone = /^(\+44|0)\d+/i.test(business.phone.replace(/\s+/g, ""));

  return hasUkDomain || hasUkCountry || hasUkPhone || postcodePattern.test(business.address);
}

export default function HeroBlock({ hero, business }: { hero: HeroContent; business: BusinessContent }) {
  const showMadeInUkBadge = looksUkBased(business);

  return (
    <section className="rounded-md border p-6 bg-white">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{hero.eyebrow}</p>
        {showMadeInUkBadge ? (
          <span className="text-[10px] uppercase tracking-wide rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
            Proudly UK Made
          </span>
        ) : null}
      </div>
      <h2 className="text-2xl font-bold mt-2">{hero.heading}</h2>
      <p className="text-sm text-muted-foreground mt-2">{hero.subheading}</p>
      <div className="flex gap-2 mt-4">
        <span className="text-xs rounded bg-primary text-primary-foreground px-2 py-1">{hero.primaryButtonText}</span>
        <span className="text-xs rounded border px-2 py-1">{hero.secondaryButtonText}</span>
      </div>
    </section>
  );
}
