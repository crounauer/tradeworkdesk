import { Link, useParams } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { getCountryLocations, COUNTRY_LABELS } from "@/data/locations";

export default function LocationHubPage() {
  const params = useParams();
  const countrySlug = params.slug ?? "";
  const countryLabel = COUNTRY_LABELS[countrySlug];
  const towns = getCountryLocations(countrySlug);

  if (!countryLabel || towns.length === 0) {
    return (
      <MarketingLayout>
        <SEOHead title="Area not found" description="Browse all tradespeople in our directory." noindex />
        <section className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">We couldn't find that area</h1>
          <Button asChild>
            <Link href="/find">Browse all tradespeople</Link>
          </Button>
        </section>
      </MarketingLayout>
    );
  }

  const groups = new Map<string, typeof towns>();
  for (const t of towns) {
    const letter = t.town[0].toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(t);
  }
  const letters = Array.from(groups.keys()).sort();

  const title = `Find a Heating & Plumbing Engineer in ${countryLabel}`;
  const description = `Browse ${towns.length} towns and cities across ${countryLabel} to find local, verified heating engineers, gas engineers, boiler specialists and plumbers on TradeWorkDesk.`;
  const canonical = `${SITE_URL}/find/${countrySlug}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find a Tradesperson", item: `${SITE_URL}/find` },
      { "@type": "ListItem", position: 2, name: countryLabel, item: canonical },
    ],
  };

  return (
    <MarketingLayout>
      <SEOHead title={title} description={description} canonical={canonical} schema={breadcrumbSchema} />

      <section className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-5">
            <Link href="/find" className="hover:text-primary">Find a Tradesperson</Link>
            <span>/</span>
            <span className="text-slate-700">{countryLabel}</span>
          </nav>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Find a Tradesperson in {countryLabel}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            Choose a town or city to find local, verified heating engineers, boiler specialists, gas engineers
            and plumbers across {countryLabel}.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap gap-1.5 mb-8">
          {letters.map((l) => (
            <a
              key={l}
              href={`#letter-${l}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-sm font-medium text-slate-600 hover:bg-primary hover:text-white transition-colors"
            >
              {l}
            </a>
          ))}
        </div>

        <div className="space-y-8">
          {letters.map((l) => (
            <div key={l} id={`letter-${l}`} className="scroll-mt-20">
              <h2 className="text-lg font-bold text-slate-900 mb-3 border-b border-slate-200 pb-1">{l}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5">
                {groups.get(l)!.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/find/${t.countrySlug}/${t.slug}`}
                    className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary transition-colors py-0.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    <span className="truncate">{t.town}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
