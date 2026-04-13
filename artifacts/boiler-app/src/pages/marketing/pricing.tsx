import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Package, Check } from "lucide-react";

interface ApiPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  features: Record<string, unknown>;
}

interface ApiAddon {
  id: string;
  name: string;
  description: string | null;
  feature_keys: string[];
  monthly_price: number;
  annual_price: number;
  is_per_seat?: boolean;
  sort_order: number;
}

const FREE_FEATURES = [
  "Job management & scheduling",
  "Gas service record forms",
  "Customer & property tracking",
  "Up to 5 jobs/month",
  "1 user included",
  "Mobile-friendly interface",
  "Free forever — no credit card",
];

const BASE_FEATURES = [
  "Everything in Free, plus:",
  "Unlimited job types & forms",
  "Basic reporting & dashboard",
  "Up to 50 jobs/month",
  "1 user included (expandable)",
  "Mobile-friendly interface",
  "30-day free trial",
];

const faqs = [
  {
    question: "Is there a free plan?",
    answer: "Yes! Our Free Forever plan includes basic job management, scheduling, and gas service record forms for 1 user with up to 5 jobs per month. No credit card required. You can upgrade to a paid plan at any time for more features.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. The base plan comes with a 30-day free trial. No credit card is required to start. You get full access to all base features during the trial period. When the trial ends, you can subscribe or continue on the free plan.",
  },
  {
    question: "How do add-ons work?",
    answer: "Add-ons are individually selectable features you can add to your base plan. Pick only what you need and pay accordingly. You can add or remove add-ons at any time from your billing settings.",
  },
  {
    question: "Can I change my add-ons later?",
    answer: "Absolutely. You can add or remove any add-on at any time from your billing settings. Changes are prorated on your next invoice.",
  },
  {
    question: "Is there a contract or commitment?",
    answer: "No. All plans are month-to-month with no long-term commitment. You can cancel at any time and your account will remain active until the end of your current billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards (Visa, Mastercard, American Express). Payments are processed securely through Stripe.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer: "Yes. Pay annually and save compared to monthly billing on both the base plan and add-ons.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer: "Your data is retained for 30 days after cancellation, during which you can export everything or reactivate your account. After 30 days, data is securely deleted in accordance with GDPR.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted in transit and at rest. We use industry-standard security practices and our infrastructure is hosted in UK/EU data centres. We are fully GDPR compliant.",
  },
];

function AddonCardSkeleton() {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-5 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-32 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-48 mb-4" />
      <div className="h-6 bg-slate-200 rounded w-20" />
    </div>
  );
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  const { data: apiPlans } = useQuery({
    queryKey: ["public-pricing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans/public");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json() as Promise<ApiPlan[]>;
    },
    staleTime: 60_000,
    retry: 2,
  });

  const { data: apiAddons, isLoading: addonsLoading } = useQuery({
    queryKey: ["public-pricing-addons"],
    queryFn: async () => {
      const res = await fetch("/api/platform/addons/public");
      if (!res.ok) throw new Error("Failed to fetch add-ons");
      return res.json() as Promise<ApiAddon[]>;
    },
    staleTime: 60_000,
    retry: 2,
  });

  const basePlan = apiPlans?.find(p => Number(p.monthly_price) > 0) ?? apiPlans?.[1] ?? apiPlans?.[0];
  const baseMonthly = basePlan ? Number(basePlan.monthly_price) : 8.50;
  const baseAnnual = basePlan && basePlan.annual_price ? Number(basePlan.annual_price) : 85;
  const basePrice = isAnnual ? baseAnnual / 12 : baseMonthly;

  const addons = apiAddons || [];

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addonTotal = addons
    .filter(a => selectedAddons.has(a.id))
    .reduce((sum, a) => sum + (isAnnual ? Number(a.annual_price) / 12 : Number(a.monthly_price)), 0);

  const totalMonthly = basePrice + addonTotal;

  const annualSavings = isAnnual
    ? (() => {
        const monthlyTotal = (basePlan ? Number(basePlan.monthly_price) : 8.50) + addons
          .filter(a => selectedAddons.has(a.id))
          .reduce((sum, a) => sum + Number(a.monthly_price), 0);
        return Math.round((1 - totalMonthly / monthlyTotal) * 100);
      })()
    : 0;

  return (
    <MarketingLayout>
      <SEOHead
        title="Pricing — Pay Only for What You Need"
        description="TradeWorkDesk starts with an affordable base plan. Add only the features you need with individual add-ons. No contracts, no hidden fees."
        canonical={`${SITE_URL}/pricing`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Pricing", url: `${SITE_URL}/pricing` },
          ]),
          faqSchema(faqs),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
            Pay only for what you need
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Start with an affordable base plan, then add only the features your business needs. No long contracts. No hidden fees.
          </p>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  !isAnnual ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  isAnnual ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Annual
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  Save more
                </span>
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white border-2 border-slate-200 p-8 shadow-sm">
              <span className="inline-block px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full mb-4">
                Free Forever
              </span>
              <h2 className="font-display text-2xl font-bold text-slate-900">Get started for free</h2>
              <p className="mt-2 text-slate-500 text-sm">
                Basic tools to manage jobs and gas service records.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-display font-bold text-slate-900">£0</span>
                <span className="text-slate-400 text-lg">/month</span>
              </div>
              <p className="mt-1 text-sm text-green-600 font-medium">No credit card required</p>

              <ul className="mt-6 space-y-2.5">
                {FREE_FEATURES.map(feature => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link href="/register?plan=free">
                  <Button variant="outline" className="w-full font-semibold text-base py-5 border-2">
                    Start Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl bg-primary text-white p-8 shadow-xl relative">
              <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 rounded-full mb-4">
                Base Plan
              </span>
              <h2 className="font-display text-2xl font-bold">Everything you need to grow</h2>
              <p className="mt-2 text-blue-100 text-sm">
                Full tools for managing your heating engineering business.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-display font-bold">
                  £{basePrice % 1 === 0 ? basePrice : basePrice.toFixed(2)}
                </span>
                <span className="text-blue-100 text-lg">/month</span>
              </div>
              {isAnnual && (
                <p className="mt-1 text-sm text-blue-200">
                  £{baseAnnual} billed annually
                </p>
              )}

              <ul className="mt-6 space-y-2.5">
                {BASE_FEATURES.map(feature => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-200 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link href="/register">
                  <Button className="w-full bg-white text-primary hover:bg-blue-50 font-semibold text-base py-5">
                    Start 30-Day Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900">
              Supercharge with add-ons
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              Select the add-ons you need. Toggle them on or off any time.
            </p>
          </div>

          {addonsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <AddonCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {addons.map(addon => {
                const selected = selectedAddons.has(addon.id);
                const price = isAnnual ? Number(addon.annual_price) / 12 : Number(addon.monthly_price);
                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className={`w-4 h-4 shrink-0 ${selected ? "text-primary" : "text-slate-400"}`} />
                          <h3 className="font-semibold text-slate-900 text-sm">{addon.name}</h3>
                        </div>
                        {addon.description && (
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{addon.description}</p>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        selected ? "border-primary bg-primary" : "border-slate-300"
                      }`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-lg font-bold text-slate-900">
                        £{price % 1 === 0 ? price : price.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">/mo{addon.is_per_seat ? ' per seat' : ''}</span>
                      {isAnnual && (
                        <span className="ml-2 text-xs text-slate-400">
                          (£{Number(addon.annual_price).toFixed(2)}/yr)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedAddons.size > 0 && (
            <div className="mt-8 max-w-md mx-auto">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">Your estimated cost</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Base plan</span>
                    <span className="font-medium">£{basePrice % 1 === 0 ? basePrice : basePrice.toFixed(2)}/mo</span>
                  </div>
                  {addons.filter(a => selectedAddons.has(a.id)).map(a => {
                    const p = isAnnual ? Number(a.annual_price) / 12 : Number(a.monthly_price);
                    return (
                      <div key={a.id} className="flex justify-between">
                        <span className="text-slate-600">{a.name}</span>
                        <span className="font-medium">£{p % 1 === 0 ? p : p.toFixed(2)}/mo</span>
                      </div>
                    );
                  })}
                  <div className="border-t pt-2 flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>£{totalMonthly % 1 === 0 ? totalMonthly : totalMonthly.toFixed(2)}/mo</span>
                  </div>
                  {isAnnual && annualSavings > 0 && (
                    <p className="text-xs text-green-600 font-medium text-right">
                      Save {annualSavings}% with annual billing
                    </p>
                  )}
                </div>
                <Link href="/register">
                  <Button className="w-full mt-2">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-slate-500">
            All prices exclude VAT. Free plan available. 30-day free trial on paid plans. No credit card required.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question} className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="font-display font-semibold text-slate-900">{faq.question}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
