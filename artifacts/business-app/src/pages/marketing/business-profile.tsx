import { Fragment, useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Globe, Mail, Wrench, CheckCircle, ArrowLeft, ShieldCheck, Star, Send } from "lucide-react";

interface DirectoryReview {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

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
  rating_average: number | null;
  rating_count: number;
  reviews: DirectoryReview[];
}

function renderInlineMarkup(value: string) {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function AboutMarkup({ value }: { value: string }) {
  const lines = value.split("\n");
  const content: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    content.push(<ul key={`list-${content.length}`} className="list-disc space-y-1 pl-5">{bullets.map((item, index) => <li key={index}>{renderInlineMarkup(item)}</li>)}</ul>);
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2));
      continue;
    }
    flushBullets();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      content.push(<h3 key={`heading-${content.length}`} className="font-semibold text-slate-900">{renderInlineMarkup(trimmed.slice(3))}</h3>);
    } else {
      content.push(<p key={`paragraph-${content.length}`}>{renderInlineMarkup(trimmed)}</p>);
    }
  }
  flushBullets();
  return <div className="space-y-3 text-slate-600 leading-relaxed">{content}</div>;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className="p-0.5"
        >
          <Star className={`w-6 h-6 ${n <= value ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} />
        </button>
      ))}
    </div>
  );
}

function ContactBusinessForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/directory/${slug}/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, website_url: websiteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send enquiry");
      setResult({ ok: true, text: "Message sent! The business will be in touch soon." });
      setName(""); setEmail(""); setPhone(""); setMessage("");
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cb-name">Your Name</Label>
        <Input id="cb-name" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="cb-email">Email</Label>
          <Input id="cb-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-phone">Phone</Label>
          <Input id="cb-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cb-message">Message</Label>
        <textarea
          id="cb-message"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[90px]"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What do you need help with?"
          required
        />
      </div>
      {/* Honeypot field, hidden from real visitors */}
      <input
        type="text"
        value={websiteUrl}
        onChange={e => setWebsiteUrl(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />
      <Button type="submit" className="w-full" disabled={submitting}>
        <Send className="w-4 h-4 mr-2" /> {submitting ? "Sending..." : "Send Message"}
      </Button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-600" : "text-destructive"}`}>{result.text}</p>
      )}
    </form>
  );
}

function LeaveReviewForm({ slug, onSubmitted }: { slug: string; onSubmitted: () => void }) {
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setResult({ ok: false, text: "Please select a star rating." }); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/directory/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer_name: reviewerName, rating, comment, website_url: websiteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review");
      setResult({ ok: true, text: data.message || "Thanks for your review!" });
      setReviewerName(""); setRating(0); setComment("");
      onSubmitted();
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Leave a Review</h3>
      <div className="space-y-1.5">
        <Label htmlFor="rv-name">Your Name</Label>
        <Input id="rv-name" value={reviewerName} onChange={e => setReviewerName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Rating</Label>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-comment">Comment (optional)</Label>
        <textarea
          id="rv-comment"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Tell others about your experience…"
        />
      </div>
      <input
        type="text"
        value={websiteUrl}
        onChange={e => setWebsiteUrl(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Review"}
      </Button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-600" : "text-destructive"}`}>{result.text}</p>
      )}
    </form>
  );
}

export default function BusinessProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const loadProfile = () => {
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
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    ...(profile.rating_count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: profile.rating_average,
        reviewCount: profile.rating_count,
      },
    }),
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/find" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to directory
          </Link>
        </div>
      </div>

      {/* Profile header */}
      <section className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-10 md:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              {profile.rating_count > 0 && (
                <p className="flex items-center gap-1.5 text-amber-600 mb-1">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span className="font-semibold">{profile.rating_average}</span>
                  <span className="text-slate-500">({profile.rating_count} review{profile.rating_count === 1 ? "" : "s"})</span>
                </p>
              )}
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About + credentials */}
          <div className="md:col-span-2 space-y-6">
            {profile.description && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">About</h2>
                <AboutMarkup value={profile.description} />
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

              <div className="pt-3 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-900 mb-3">Or send a message</p>
                <ContactBusinessForm slug={profile.slug} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Reviews {profile.rating_count > 0 && `(${profile.rating_count})`}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowReviewForm(v => !v)}>
              {showReviewForm ? "Cancel" : "Leave a Review"}
            </Button>
          </div>

          {showReviewForm && (
            <div className="mb-6">
              <LeaveReviewForm slug={profile.slug} onSubmitted={() => setShowReviewForm(false)} />
            </div>
          )}

          {profile.reviews.length === 0 ? (
            <p className="text-slate-500 text-sm">No reviews yet. Be the first to leave one.</p>
          ) : (
            <div className="space-y-4">
              {profile.reviews.map(rv => (
                <div key={rv.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-slate-900">{rv.reviewer_name}</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={`w-3.5 h-3.5 ${n <= rv.rating ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} />
                      ))}
                    </div>
                  </div>
                  {rv.comment && <p className="text-sm text-slate-600">{rv.comment}</p>}
                </div>
              ))}
            </div>
          )}
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
