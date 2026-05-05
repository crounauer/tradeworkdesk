import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Mail, Wrench, CheckCircle, ArrowLeft, ShieldCheck } from "lucide-react";

interface BusinessProfile {
  slug: string;
  name: string;
  description: string | null;
  trade_types: string[];
  service_area: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  gas_safe_number: string | null;
  oftec_number: string | null;
}

export default function BusinessProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/directory/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => {
        if (data) setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <MarketingLayout>
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-3/4" />
          </div>
        </div>
      </MarketingLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <MarketingLayout>
        <SEOHead title="Business Not Found" description="This business could not be found." noindex />
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Business Not Found</h1>
          <p className="text-slate-500 mb-6">This listing may have been removed or the URL is incorrect.</p>
          <Button asChild variant="outline">
            <Link href="/find"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory</Link>
          </Button>
        </div>
      </MarketingLayout>
    );
  }

  const addressParts = [profile.address_line1, profile.address_line2, profile.city, profile.county, profile.postcode].filter(Boolean);
  const pageUrl = `${SITE_URL}/find/${profile.slug}`;

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.name,
    description: profile.description || undefined,
    url: pageUrl,
    ...(profile.phone && { telephone: profile.phone }),
    ...(profile.email && { email: profile.email }),
    ...(profile.website && { sameAs: [profile.website] }),
    ...(profile.logo_url && { logo: profile.logo_url }),
    address: addressParts.length > 0 ? {
      "@type": "PostalAddress",
      streetAddress: [profile.address_line1, profile.address_line2].filter(Boolean).join(", ") || undefined,
      addressLocality: profile.city || undefined,
      addressRegion: profile.county || undefined,
      postalCode: profile.postcode || undefined,
      addressCountry: "GB",
    } : undefined,
  };

  return (
    <MarketingLayout>
      <SEOHead
        title={`${profile.name} — Local Heating & Plumbing Engineer`}
        description={
          profile.description ||
          `${profile.name} is a heating and plumbing specialist${profile.service_area ? ` serving ${profile.service_area}` : ""}. Find contact details and services.`
        }
        canonical={pageUrl}
        ogType="profile"
        schema={localBusinessSchema}
      />

      {/* Back nav */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/find" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to directory
          </Link>
        </div>
      </div>

      {/* Profile header */}
      <section className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-10 md:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt={`${profile.name} logo`}
                className="w-20 h-20 rounded-2xl object-contain border border-slate-200 bg-white p-1 flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-8 h-8 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">{profile.name}</h1>
              {profile.service_area && (
                <p className="flex items-center gap-1.5 text-slate-600 mb-3">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  {profile.service_area}
                </p>
              )}
              {profile.trade_types.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.trade_types.map(t => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About + credentials */}
          <div className="md:col-span-2 space-y-6">
            {profile.description && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">About</h2>
                <p className="text-slate-600 leading-relaxed">{profile.description}</p>
              </div>
            )}

            {(profile.gas_safe_number || profile.oftec_number) && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Accreditations</h2>
                <div className="flex flex-col gap-2">
                  {profile.gas_safe_number && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                      <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Gas Safe Registered</p>
                        <p className="text-xs text-green-700">Registration No. {profile.gas_safe_number}</p>
                      </div>
                    </div>
                  )}
                  {profile.oftec_number && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
                      <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">OFTEC Registered</p>
                        <p className="text-xs text-blue-700">Registration No. {profile.oftec_number}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Services listed */}
            {profile.trade_types.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Services Offered</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.trade_types.map(t => (
                    <li key={t} className="flex items-center gap-2 text-slate-700">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Contact card */}
          <div className="md:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 sticky top-20">
              <h2 className="text-base font-semibold text-slate-900">Get in Touch</h2>

              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-3 text-slate-700 hover:text-primary transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{profile.phone}</span>
                </a>
              )}

              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 text-slate-700 hover:text-primary transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium truncate">{profile.email}</span>
                </a>
              )}

              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-700 hover:text-primary transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium truncate">
                    {profile.website.replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                </a>
              )}

              {addressParts.length > 0 && (
                <div className="flex items-start gap-3 text-slate-700">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <address className="text-sm not-italic leading-relaxed">
                    {addressParts.map((part, i) => (
                      <span key={i}>{part}{i < addressParts.length - 1 ? ", " : ""}</span>
                    ))}
                  </address>
                </div>
              )}

              {profile.phone && (
                <Button asChild className="w-full mt-2">
                  <a href={`tel:${profile.phone}`}>
                    <Phone className="w-4 h-4 mr-2" /> Call Now
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <p className="text-slate-600 mb-4">
            Are you a heating engineer or plumber? Get your business listed — free with any plan.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/register">Join TradeWorkDesk</Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
