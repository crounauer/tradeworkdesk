import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, ArrowRight, Minus } from "lucide-react";

type FeatureValue = true | false | string;

interface Feature {
  label: string;
  value: FeatureValue;
}

interface Plan {
  name: string;
  base: string;
  perUser: string | null;
  userNote: string;
  desc: string;
  popular?: boolean;
  features: Feature[];
}

const plans: Plan[] = [
  {
    name: "Starter",
    base: "29",
    perUser: null,
    userNote: "1 user included",
    desc: "For solo engineers",
    features: [
      { label: "Forms", value: "Unlimited" },
      { label: "Signatures", value: "Unlimited" },
      { label: "Per user", value: "Included" },
      { label: "Jobs", value: "Unlimited" },
      { label: "Scheduling", value: true },
      { label: "Reports", value: "Basic" },
      { label: "Photo storage", value: "5 GB" },
      { label: "Compliance forms", value: true },
      { label: "API access", value: false },
      { label: "Custom branding", value: false },
      { label: "Analytics", value: false },
      { label: "Priority support", value: false },
    ],
  },
  {
    name: "Professional",
    base: "49",
    perUser: "12",
    userNote: "Up to 10 users",
    desc: "For growing teams",
    popular: true,
    features: [
      { label: "Forms", value: "Unlimited" },
      { label: "Signatures", value: "Unlimited" },
      { label: "Per user", value: "£12 / user" },
      { label: "Jobs", value: "Unlimited" },
      { label: "Scheduling", value: true },
      { label: "Reports", value: "Full" },
      { label: "Photo storage", value: "25 GB" },
      { label: "Compliance forms", value: true },
      { label: "API access", value: false },
      { label: "Custom branding", value: false },
      { label: "Analytics", value: true },
      { label: "Priority support", value: true },
    ],
  },
  {
    name: "Business",
    base: "79",
    perUser: "9",
    userNote: "Unlimited users",
    desc: "For established companies",
    features: [
      { label: "Forms", value: "Unlimited" },
      { label: "Signatures", value: "Unlimited" },
      { label: "Per user", value: "£9 / user" },
      { label: "Jobs", value: "Unlimited" },
      { label: "Scheduling", value: true },
      { label: "Reports", value: "Full + Export" },
      { label: "Photo storage", value: "Unlimited" },
      { label: "Compliance forms", value: true },
      { label: "API access", value: true },
      { label: "Custom branding", value: true },
      { label: "Analytics", value: "Advanced" },
      { label: "Priority support", value: true },
    ],
  },
];

const faqs = [
  {
    question: "Is there a free trial?",
    answer: "Yes. Every plan comes with a 14-day free trial. No credit card is required to start. You get full access to all features in your chosen plan during the trial period.",
  },
  {
    question: "How does per-user pricing work?",
    answer: "The Professional plan is £49/month base plus £12 per additional user per month. The Business plan is £79/month base plus £9 per user per month. The Starter plan is a flat £29/month for a single user — no per-user charge.",
  },
  {
    question: "Can I change plans later?",
    answer: "Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle. No penalties or hidden fees.",
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
    answer: "Yes. Pay annually and save 20% compared to monthly billing. Contact us for annual pricing details.",
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

function FeatureValue({ value, popular }: { value: FeatureValue; popular?: boolean }) {
  if (value === true) {
    return <CheckCircle className={`w-4 h-4 shrink-0 ${popular ? "text-blue-200" : "text-green-500"}`} />;
  }
  if (value === false) {
    return <Minus className={`w-4 h-4 shrink-0 ${popular ? "text-blue-300/40" : "text-slate-300"}`} />;
  }
  return (
    <span className={`text-xs font-semibold shrink-0 ${popular ? "text-blue-100" : "text-primary"}`}>
      {value}
    </span>
  );
}

export default function PricingPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Pricing — Simple, Transparent Plans"
        description="BoilerTech pricing starts at £29/month. No contracts, no hidden fees. Compare Starter, Professional, and Business plans for your heating engineering business."
        canonical={`${SITE_URL}/pricing`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Pricing", url: `${SITE_URL}/pricing` },
          ]),
          faqSchema(faqs),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
                Simple, transparent pricing
              </h1>
              <p className="mt-4 text-lg text-slate-600 max-w-2xl">
                No long contracts. No hidden fees. Start with a 14-day free trial on any plan.
              </p>
            </div>
            <div className="shrink-0 flex items-center justify-center">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="BoilerTech"
                className="w-64 h-64 md:w-80 md:h-80 object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl flex flex-col ${
                  plan.popular
                    ? "bg-primary text-white ring-2 ring-primary shadow-xl md:-mt-4"
                    : "bg-white border border-slate-200"
                }`}
              >
                <div className="p-8 pb-6">
                  {plan.popular && (
                    <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 rounded-full mb-4">
                      Most Popular
                    </span>
                  )}
                  <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                  <p className={`mt-1 text-sm ${plan.popular ? "text-blue-100" : "text-slate-500"}`}>
                    {plan.desc}
                  </p>

                  <div className="mt-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-display font-bold">£{plan.base}</span>
                      <span className={`text-sm ${plan.popular ? "text-blue-100" : "text-slate-500"}`}>/month</span>
                    </div>
                    {plan.perUser ? (
                      <p className={`mt-1 text-sm font-medium ${plan.popular ? "text-blue-200" : "text-slate-500"}`}>
                        + £{plan.perUser} per user / month
                      </p>
                    ) : (
                      <p className={`mt-1 text-sm font-medium ${plan.popular ? "text-blue-200" : "text-slate-500"}`}>
                        flat rate — no per-user charge
                      </p>
                    )}
                    <p className={`mt-0.5 text-xs ${plan.popular ? "text-blue-300" : "text-slate-400"}`}>
                      {plan.userNote}
                    </p>
                  </div>
                </div>

                <div className={`border-t mx-6 ${plan.popular ? "border-white/20" : "border-slate-100"}`} />

                <ul className="px-8 py-6 space-y-3 flex-1">
                  {plan.features.map(({ label, value }) => (
                    <li key={label} className="flex items-center justify-between gap-3 text-sm">
                      <span className={value === false ? (plan.popular ? "text-blue-200/50" : "text-slate-400") : ""}>
                        {label}
                      </span>
                      <FeatureValue value={value} popular={plan.popular} />
                    </li>
                  ))}
                </ul>

                <div className="px-8 pb-8">
                  <Link href="/register">
                    <Button
                      className={`w-full ${plan.popular ? "bg-white text-primary hover:bg-blue-50" : ""}`}
                      variant={plan.popular ? "secondary" : "default"}
                    >
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            All prices exclude VAT. 14-day free trial on every plan. No credit card required.
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
