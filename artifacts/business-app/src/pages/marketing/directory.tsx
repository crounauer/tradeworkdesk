import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Phone, Globe, Wrench, Star } from "lucide-react";

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
  distance_miles: number | null;
  rating_average: number | null;
  rating_count: number;
}

export default function DirectoryPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [location, setLocation] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [radius, setRadius] = useState("");
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search inputs
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(location), 500);
    return () => clearTimeout(t);
  }, [location]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (debouncedLocation) params.set("location", debouncedLocation);
    if (debouncedLocation && radius) params.set("radius", radius);

    fetch(`/api/directory${params.size ? `?${params}` : ""}`)
      .then(r => r.json())
      .then(data => {
        setListings(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(() => setError("Failed to load directory. Please try again."))
      .finally(() => setLoading(false));
  }, [debouncedQuery, debouncedLocation, radius]);

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
          <div className="max-w-xl mx-auto space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                type="search"
                placeholder="Search by name or trade…"
                className="pl-9 h-12 text-base"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Postcode or town…"
                  className="pl-9 h-11 text-base"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>
              <Select value={radius || "any"} onValueChange={(v) => setRadius(v === "any" ? "" : v)}>
                <SelectTrigger className="w-36 h-11 bg-white">
                  <SelectValue placeholder="Any distance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any distance</SelectItem>
                  <SelectItem value="5">Within 5 miles</SelectItem>
                  <SelectItem value="10">Within 10 miles</SelectItem>
                  <SelectItem value="20">Within 20 miles</SelectItem>
                  <SelectItem value="50">Within 50 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {debouncedQuery || debouncedLocation
                ? "No results match your search. Try a different location or search term."
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
              <Link href="/register">Start 30-Day Free Trial</Link>
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
