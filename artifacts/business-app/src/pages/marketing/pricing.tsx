import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Briefcase, Globe } from "lucide-react";

const JOB_FEATURES = [
  "Unlimited jobs & job types",
  "Gas, oil & heat pump service records",
  "Customer & property management",
  "Invoicing & payment tracking",
  "Scheduling & Google Calendar sync",
  "Team management & job assignment",
  "Parts & service catalogue",
  "Digital signatures on mobile",
  "Compliance forms & combustion analysis",
  "UK address lookup & geo-mapping",
  "Report export (PDF & CSV)",
  "Social media post scheduling",
  "Advanced analytics dashboard",
];

const WEBSITE_FEATURES = [
  "Drag-and-drop website builder",
  "Custom domain connection (e.g. yoursite.co.uk)",
  "Free platform subdomain, instant setup",
  "SEO-optimised pages & sitemap",
  "Contact & quote forms",
  "Auto-create job enquiry from every form submission",
  "Blog with AI content assistance",
  "Photo gallery & project showcase",
  "Google reviews & testimonials",
  "Services, FAQ & process pages",
  "Google Analytics integration",
  "Mobile-responsive on every device",
];

const faqs = [
  {
    question: "Is there a free trial?",
    answer: "Yes. Every account starts with a 30-day free trial with full access to all features. No credit card required to start.",
  },
  {
    question: "How does per-user billing work?",
    answer: "The £25/month plan includes 2 users (e.g. an admin and one engineer). Each additional user is £10/month. So a team of 5 would be £25 + 3×£10 = £55/month.",
  },
  {
    question: "Can I add engineers mid-month?",
    answer: "Yes. Add users at any time and we'll prorate the charge on your next invoice so you only pay for the days they were active.",
  },
  {
    question: "Is there a contract or commitment?",
    answer: "No. It's month-to-month with no long-term commitment. Cancel any time and your account stays active until the end of your billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "All major credit and debit cards (Visa, Mastercard, American Express). Payments are processed securely through Stripe.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer: "Your data is retained for 30 days after cancellation, during which you can export everything. After 30 days, data is securely deleted in line with GDPR.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted in transit and at rest. Our infrastructure is hosted in UK/EU data centres and we are fully GDPR compliant.",
  },
  {
    question: "Does the website builder cost extra?",
    answer: "No. The website builder is included in every plan at no extra cost. You can build a fully SEO-optimised business website, connect your own custom domain, and manage all your pages from within the app.",
  },
  {
    question: "Can I use my own domain for the website?",
    answer: "Yes. You can connect any domain you own. We also provide a free platform subdomain (e.g. yourbusiness.tradeworkdesk.co.uk) that is active instantly while you set up your custom domain.",
  },
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Pricing — One plan. Everything included."
        description="TradeWorkDesk is £25/month for up to 2 users, with every feature included. Add more engineers at £10/month each. No contracts, no hidden fees."
        canonical={`${SITE_URL}/pricing`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Pricing", url: `${SITE_URL}/pricing` },
          ]),
          faqSchema(faqs),
        ]}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 to-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-3 py-1 text-xs font-semibold bg-primary/10 text-primary rounded-full mb-4">
            Simple pricing
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
            One plan. Everything included.
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            No tiers. No add-ons to figure out. Every feature is included from day one.
          </p>
        </div>
      </section>

      {/* Plan card */}
      <section className="bg-white py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-primary text-white p-8 md:p-12 shadow-xl">
            {/* Price + CTA */}
            <div className="flex flex-col md:flex-row gap-8 items-start mb-10">
              <div className="flex-1">
                <h2 className="font-display text-3xl font-bold">TradeWorkDesk</h2>
                <p className="mt-2 text-blue-100">
                  Job management <em>and</em> a professional website — both fully included, no extras.
                </p>
                <div className="mt-6 flex items-end gap-2">
                  <span className="font-display text-6xl font-bold">£25</span>
                  <div className="pb-1">
                    <div className="text-blue-100">/month</div>
                    <div className="text-sm text-blue-200">includes 2 users</div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-blue-200">
                  + £10/month per additional user &nbsp;·&nbsp; billed monthly &nbsp;·&nbsp; cancel any time
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link href="/register">
                    <Button className="bg-white text-primary hover:bg-blue-50 font-semibold text-base px-8 py-5">
                      Start 30-day free trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
                <p className="mt-3 text-xs text-blue-300">No credit card required for trial.</p>
              </div>
            </div>

            {/* Two-column feature groups */}
            <div className="grid md:grid-cols-2 gap-8 border-t border-blue-500/40 pt-8">
              {/* Job Management */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-4 h-4 text-blue-300" />
                  <h3 className="font-semibold text-blue-100 uppercase text-xs tracking-wide">
                    Job Management
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {JOB_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Website Builder */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-blue-300" />
                  <h3 className="font-semibold text-blue-100 uppercase text-xs tracking-wide">
                    Website Builder
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {WEBSITE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Per-seat explainer */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h3 className="font-semibold text-slate-900 mb-3">Growing team?</h3>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600">
              <span className="rounded-lg bg-white border border-slate-200 px-4 py-2">
                1–2 engineers &nbsp;→&nbsp; <strong>£25/mo</strong>
              </span>
              <span className="rounded-lg bg-white border border-slate-200 px-4 py-2">
                3 engineers &nbsp;→&nbsp; <strong>£35/mo</strong>
              </span>
              <span className="rounded-lg bg-white border border-slate-200 px-4 py-2">
                5 engineers &nbsp;→&nbsp; <strong>£55/mo</strong>
              </span>
              <span className="rounded-lg bg-white border border-slate-200 px-4 py-2">
                10 engineers &nbsp;→&nbsp; <strong>£105/mo</strong>
              </span>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              All prices exclude VAT. Extra users are billed pro-rata if added mid-month.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
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

