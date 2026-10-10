import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Wrench, Star, ArrowRight, CheckCircle, ShieldCheck, Users } from "lucide-react";
import {
  getLocation, getNearbyLocations, getFeaturedLocations,
  COUNTRY_LABELS, SITE_URL, PUBLISHER,
} from "@/data/locations";

interface BusinessListing {
  slug: string;
  name: string;
  description: string | null;
  trade_types: string[];
  service_area: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  distance_miles: number | null;
  rating_average: number | null;
  rating_count: number;
  gas_safe_registered?: boolean;
  oftec_registered?: boolean;
}

const TRADES = [
  "Gas Engineers", "Boiler Service & Repair", "Heat Pump Engineers",
  "Oil & OFTEC Engineers", "Plumbers", "Landlord Gas Safety",
];

const LAST_UPDATED =
  (import.meta.env.VITE_BUILD_DATE as string) || new Date().toISOString().slice(0, 10);

/** Deterministic pick so each town gets a stable, varied intro (not one template). */
function introVariant(townSlug: string, town: string, countryLabel: string, region: string | null, population: number | null, nearest: string | null): string {
  const where = region ? `${town}, in ${region},` : `${town} in ${countryLabel}`;
  const pop = population ? ` Home to around ${population.toLocaleString()} people,` : "";
  const near = nearest ? ` It also puts you within reach of engineers covering nearby ${nearest}.` : "";
  const variants = [
    `Looking for a reliable heating engineer, boiler specialist, gas engineer or plumber in ${town}?${pop} ${where} is served by tradespeople who manage their jobs, customers and compliance through TradeWorkDesk.${near}`,
    `Need a trusted gas engineer, plumber or heat pump installer in ${town}?${pop} Browse local, verified tradespeople covering ${town} and the surrounding ${region ?? countryLabel} area — every one of them runs their business on TradeWorkDesk.${near}`,
    `Find heating and plumbing professionals serving ${town}.${pop} From annual boiler services and breakdowns to full heat pump and oil installations, the engineers listed here cover ${where.replace(/,$/, "")} and keep their qualifications and records up to date.${near}`,
  ];
  let h = 0;
  for (let i = 0; i < townSlug.length; i++) h = (h * 31 + townSlug.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}

export default function LocationPage() {
  const params = useParams();
  const countrySlug = params.country ?? "";
  const townSlug = params.town ?? "";
  const location = getLocation(countrySlug, townSlug);

  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    const geoCountry = location.countrySlug === "ireland" ? "ie" : "gb";
    fetch(`/api/directory?location=${encodeURIComponent(location.town)}&radius=25&country=${geoCountry}`)
      .then((r) => r.json())
      .then((d) => setListings(Array.isArray(d) ? d : []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.countrySlug, location?.slug]);

  if (!location) {
    return (
      <MarketingLayout>
        <SEOHead
          title="Area not found"
          description="We could not find this location. Browse all tradespeople in our directory."
          noindex
        />
        <section className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">We couldn't find that area</h1>
          <p className="text-slate-600 mb-6">The location you're looking for isn't in our directory yet.</p>
          <Button asChild>
            <Link href="/find">Browse all tradespeople</Link>
          </Button>
        </section>
      </MarketingLayout>
    );
  }

  const countryLabel = COUNTRY_LABELS[countrySlug] ?? location.country;
  const nearby = getNearbyLocations(location, 12);
  const featured = getFeaturedLocations(countrySlug).filter((l) => l.slug !== location.slug).slice(0, 8);
  const nearestTown = nearby[0]?.town ?? null;

  const hasListings = listings.length > 0;
  // Index only towns with genuine local value — i.e. real listing coverage,
  // decided at build time (apply-coverage.mjs). Kept consistent with the
  // prerendered HTML and the sitemap so there's a single indexing signal.
  const shouldIndex = location.indexable;

  const ratingValues = listings.filter((l) => l.rating_count > 0);
  const totalReviews = ratingValues.reduce((s, l) => s + l.rating_count, 0);
  const avgRating = ratingValues.length
    ? (ratingValues.reduce((s, l) => s + (l.rating_average ?? 0) * l.rating_count, 0) / totalReviews).toFixed(1)
    : null;

  const title = `Find a Heating & Plumbing Engineer in ${location.town}`;
  const description = region(location.region)
    ? `Find local, verified heating engineers, gas engineers, boiler specialists and plumbers in ${location.town}, ${location.region}. Compare trades, reviews and contact details on TradeWorkDesk.`
    : `Find local, verified heating engineers, gas engineers, boiler specialists and plumbers in ${location.town}, ${countryLabel}. Compare trades, reviews and contact details on TradeWorkDesk.`;
  const canonical = `${SITE_URL}/find/${countrySlug}/${location.slug}`;
  const intro = introVariant(location.slug, location.town, countryLabel, location.region, location.population, nearestTown);

  const schema = buildSchema({ location, countryLabel, canonical, title, description, listings });

  return (
    <MarketingLayout>
      <SEOHead
        title={title}
        description={description}
        canonical={canonical}
        schema={schema}
        noindex={!shouldIndex}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-5">
            <Link href="/find" className="hover:text-primary">Find a Tradesperson</Link>
            <span>/</span>
            <Link href={`/find/${countrySlug}`} className="hover:text-primary">{countryLabel}</Link>
            <span>/</span>
            <span className="text-slate-700">{location.town}</span>
          </nav>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Wrench className="w-4 h-4" />
            Trusted Tradespeople
          </div>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Find a Heating &amp; Plumbing Engineer in {location.town}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">{intro}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {TRADES.map((t) => (
              <Badge key={t} variant="secondary" className="text-sm font-normal">{t}</Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Local facts — unique, verifiable data per town */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Fact label="Country" value={countryLabel} />
          {location.region && <Fact label="Area" value={location.region} />}
          {location.population != null && <Fact label="Population" value={location.population.toLocaleString()} />}
          {nearestTown && nearby[0]?.distanceMiles != null && (
            <Fact label="Nearest town" value={`${nearestTown} (${nearby[0].distanceMiles} mi)`} />
          )}
        </dl>
      </section>

      {/* Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <h2 className="text-xl font-bold text-slate-900">Tradespeople near {location.town}</h2>
          {!loading && hasListings && (
            <p className="text-sm text-slate-500">
              {listings.length} listed{avgRating ? ` · ${avgRating}★ from ${totalReviews} reviews` : ""}
            </p>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-5 animate-pulse bg-slate-50 h-40" />
            ))}
          </div>
        )}

        {!loading && !hasListings && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-1 font-medium">No tradespeople are listed in {location.town} yet.</p>
            <p className="text-slate-500 text-sm mb-5">Are you a local engineer or plumber? Be the first to get listed here.</p>
            <Button asChild><Link href="/register">Get listed free</Link></Button>
          </div>
        )}

        {!loading && hasListings && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((b) => (
              <Link
                key={b.slug}
                href={`/find/${b.slug}`}
                className="group block rounded-xl border border-slate-200 bg-white p-5 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={`${b.name} logo`} className="w-12 h-12 rounded-lg object-contain border border-slate-100 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">{b.name}</h3>
                    {(b.service_area || b.city) && (
                      <p className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {b.service_area || b.city}
                        {b.distance_miles != null && ` · ${b.distance_miles} mi`}
                      </p>
                    )}
                    {b.rating_count > 0 && (
                      <p className="flex items-center gap-1 text-sm text-amber-600 mt-0.5">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {b.rating_average} <span className="text-slate-400">({b.rating_count})</span>
                      </p>
                    )}
                  </div>
                </div>
                {b.trade_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {b.trade_types.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
                {(b.gas_safe_registered || b.oftec_registered) && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {b.gas_safe_registered && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                        <ShieldCheck className="w-3 h-3" /> Gas Safe
                      </span>
                    )}
                    {b.oftec_registered && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                        <ShieldCheck className="w-3 h-3" /> OFTEC
                      </span>
                    )}
                  </div>
                )}
                {b.description && <p className="text-sm text-slate-600 line-clamp-2">{b.description}</p>}
                <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                  {b.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{b.phone}</span>}
                  {b.website && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[120px]">{b.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trust / E-E-A-T */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> How listings work
              </h2>
              <p className="text-sm text-slate-600">
                Every business shown in {location.town} runs its jobs, certificates and customer records on
                TradeWorkDesk. Listings display the trades and registrations each engineer provides — always
                confirm a tradesperson's registration before work begins.
              </p>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                <Users className="w-5 h-5 text-primary" /> Check their qualifications
              </h2>
              <p className="text-sm text-slate-600">
                Gas work must be done by a{" "}
                <a href="https://www.gassaferegister.co.uk/" target="_blank" rel="noopener nofollow" className="text-primary hover:underline">Gas Safe registered</a>{" "}
                engineer; oil heating work should be carried out by an{" "}
                <a href="https://www.oftec.org/" target="_blank" rel="noopener nofollow" className="text-primary hover:underline">OFTEC registered</a>{" "}
                technician. You can verify any registration directly with those bodies.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-5">Listings updated {LAST_UPDATED}.</p>
        </div>
      </section>

      {/* Nearby + popular */}
      {nearby.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Towns near {location.town}</h2>
            <div className="flex flex-wrap gap-2">
              {nearby.map((n) => (
                <Link
                  key={n.slug}
                  href={`/find/${n.countrySlug}/${n.slug}`}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {n.town}{n.distanceMiles != null ? <span className="text-slate-400"> · {n.distanceMiles} mi</span> : null}
                </Link>
              ))}
            </div>
            <Link href={`/find/${countrySlug}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-5 hover:underline">
              See all towns in {countryLabel} <ArrowRight className="w-4 h-4" />
            </Link>

            {featured.length > 0 && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Popular areas in {countryLabel}</h2>
                <div className="flex flex-wrap gap-2">
                  {featured.map((f) => (
                    <Link
                      key={f.slug}
                      href={`/find/${f.countrySlug}/${f.slug}`}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {f.town}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Finding a tradesperson in {location.town}</h2>
        <div className="space-y-6">
          {faqItems(location, countryLabel).map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-900 mb-1.5 flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />{f.q}
              </h3>
              <p className="text-slate-600 pl-7">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Are you a heating engineer or plumber in {location.town}?</h2>
          <p className="text-slate-600 mb-6">Get your business listed in our {location.town} directory — free with any TradeWorkDesk plan.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild><Link href="/register">Start 30-Day Free Trial</Link></Button>
            <Button variant="outline" asChild><Link href="/find">Browse the directory</Link></Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function region(r: string | null): r is string {
  return Boolean(r);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800 mt-0.5">{value}</dd>
    </div>
  );
}

function faqItems(location: { town: string; region: string | null }, countryLabel: string) {
  const area = location.region ? `${location.town}, ${location.region}` : `${location.town}, ${countryLabel}`;
  return [
    {
      q: `How do I find a heating engineer or plumber in ${location.town}?`,
      a: `Browse the verified tradespeople listed on this page, or search our wider directory. Every business on TradeWorkDesk manages their jobs and compliance through the platform, so you can compare trades, reviews and contact details before getting in touch.`,
    },
    {
      q: `Are the tradespeople serving ${area} qualified?`,
      a: `Listings show each engineer's trades and any registrations they've added, such as Gas Safe or OFTEC. Always confirm a tradesperson's registration with the relevant body before work begins.`,
    },
    {
      q: `I'm a tradesperson in ${location.town} — how do I get listed?`,
      a: `Start a free 30-day trial of TradeWorkDesk. A directory listing for ${location.town} is included on every plan, helping local customers find you.`,
    },
  ];
}

function buildSchema({ location, countryLabel, canonical, title, description, listings }: {
  location: { town: string; region: string | null; lat: number | null; lng: number | null; countrySlug: string; slug: string };
  countryLabel: string; canonical: string; title: string; description: string;
  listings: Array<{ name: string; slug: string }>;
}) {
  const org = { "@type": "Organization", name: PUBLISHER.name, url: PUBLISHER.url, logo: { "@type": "ImageObject", url: PUBLISHER.logo } };

  const webPage = {
    "@context": "https://schema.org", "@type": "WebPage",
    name: `${title} | ${PUBLISHER.name}`, url: canonical, description, dateModified: LAST_UPDATED,
    isPartOf: { "@type": "WebSite", name: PUBLISHER.name, url: PUBLISHER.url }, publisher: org,
  };

  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Find a Tradesperson", item: `${SITE_URL}/find` },
      { "@type": "ListItem", position: 2, name: countryLabel, item: `${SITE_URL}/find/${location.countrySlug}` },
      { "@type": "ListItem", position: 3, name: location.town, item: canonical },
    ],
  };

  const service = {
    "@context": "https://schema.org", "@type": "Service",
    name: `Heating & plumbing engineers in ${location.town}`,
    serviceType: "Heating, gas and plumbing engineers", provider: org, url: canonical,
    areaServed: location.lat != null && location.lng != null
      ? { "@type": "GeoCircle", geoMidpoint: { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng }, geoRadius: 25000 }
      : { "@type": "City", name: location.town },
  };

  const faq = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqItems(location, countryLabel).map((f) => ({
      "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const schema: Record<string, unknown>[] = [webPage, breadcrumb, service, faq];

  if (listings.length > 0) {
    schema.push({
      "@context": "https://schema.org", "@type": "ItemList", name: `Tradespeople in ${location.town}`,
      numberOfItems: listings.length,
      itemListElement: listings.slice(0, 20).map((l, i) => ({
        "@type": "ListItem", position: i + 1, name: l.name, url: `${SITE_URL}/find/${l.slug}`,
      })),
    });
  }
  return schema;
}
