import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Phone, Globe, Wrench } from "lucide-react";

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
  email: string | null;
  website: string | null;
  logo_url: string | null;
}

export default function DirectoryPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);

    fetch(`/api/directory${params.size ? `?${params}` : ""}`)
      .then(r => r.json())
      .then(data => {
        setListings(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(() => setError("Failed to load directory. Please try again."))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const locationLabel = (b: BusinessListing) => {
    const parts = [b.service_area || b.city, b.county].filter(Boolean);
    return parts.length ? parts[0] : b.postcode || null;
  };

  return (
    <MarketingLayout>
      <SEOHead
        title="Find a Local Heating & Plumbing Engineer"
        description="Search our directory of verified heating engineers, boiler service specialists, gas engineers, and plumbers. Find a trusted tradesperson near you."
        canonical={`${SITE_URL}/find`}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Wrench className="w-4 h-4" />
            Trusted Tradespeople
          </div>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Find a Heating &amp; Plumbing Engineer
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Browse local, verified heating engineers, boiler specialists, gas engineers, and plumbers — all using TradeWorkDesk.
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by name, trade, or location…"
              className="pl-9 h-12 text-base"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-5 animate-pulse bg-slate-50 h-40" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-red-500 py-16">{error}</p>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="text-center py-16">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-lg">
              {debouncedQuery
                ? `No results for "${debouncedQuery}". Try a different search.`
                : "No businesses are listed yet."}
            </p>
          </div>
        )}

        {!loading && !error && listings.length > 0 && (
          <>
            <p className="text-sm text-slate-500 mb-6">
              {listings.length} {listings.length === 1 ? "business" : "businesses"} found
              {debouncedQuery ? ` for "${debouncedQuery}"` : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map(b => (
                <Link
                  key={b.slug}
                  href={`/find/${b.slug}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-5 hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt={`${b.name} logo`}
                        className="w-12 h-12 rounded-lg object-contain border border-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
                        {b.name}
                      </h2>
                      {locationLabel(b) && (
                        <p className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          {locationLabel(b)}
                        </p>
                      )}
                    </div>
                  </div>

                  {b.trade_types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {b.trade_types.slice(0, 3).map(t => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                      {b.trade_types.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{b.trade_types.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {b.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{b.description}</p>
                  )}

                  <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
                    {b.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {b.phone}
                      </span>
                    )}
                    {b.website && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">
                          {b.website.replace(/^https?:\/\/(www\.)?/, "")}
                        </span>
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* CTA for businesses */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Are you a heating engineer or plumber?</h2>
          <p className="text-slate-600 mb-6">
            Get your business listed on this directory — free with any TradeWorkDesk plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/register">Start Free Trial</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">View Plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
