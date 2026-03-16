import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "29",
    desc: "For solo engineers",
    features: {
      "Users": "1",
      "Jobs per month": "Unlimited",
      "Digital forms": true,
      "Customer records": true,
      "Property & appliance tracking": true,
      "Digital signatures": true,
      "Photo attachments": true,
      "Mobile access": true,
      "Reports & analytics": false,
      "Team scheduling": false,
      "Invite codes": false,
      "Priority support": false,
      "API access": false,
      "Custom branding": false,
    },
  },
  {
    name: "Professional",
    price: "59",
    desc: "For growing teams",
    popular: true,
    features: {
      "Users": "Up to 5",
      "Jobs per month": "Unlimited",
      "Digital forms": true,
      "Customer records": true,
      "Property & appliance tracking": true,
      "Digital signatures": true,
      "Photo attachments": true,
      "Mobile access": true,
      "Reports & analytics": true,
      "Team scheduling": true,
      "Invite codes": true,
      "Priority support": true,
      "API access": false,
      "Custom branding": false,
    },
  },
  {
    name: "Business",
    price: "99",
    desc: "For established companies",
    features: {
      "Users": "Unlimited",
      "Jobs per month": "Unlimited",
      "Digital forms": true,
      "Customer records": true,
      "Property & appliance tracking": true,
      "Digital signatures": true,
      "Photo attachments": true,
      "Mobile access": true,
      "Reports & analytics": true,
      "Team scheduling": true,
      "Invite codes": true,
      "Priority support": true,
      "API access": true,
      "Custom branding": true,
    },
  },
];

const faqs = [
  {
    question: "Is there a free trial?",
    answer: "Yes. Every plan comes with a 14-day free trial. No credit card is required to start. You get full access to all features in your chosen plan during the trial period.",
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
  {
    question: "Can I add more users to the Starter plan?",
    answer: "The Starter plan is designed for solo engineers. If you need more than one user, the Professional plan supports up to 5 users, and the Business plan offers unlimited users.",
  },
];

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col ${
                  plan.popular
                    ? "bg-primary text-white ring-2 ring-primary shadow-xl md:scale-105"
                    : "bg-white border border-slate-200"
                }`}
              >
                {plan.popular && (
                  <span className="inline-block self-start px-3 py-1 text-xs font-semibold bg-white/20 rounded-full mb-4">
                    Most Popular
                  </span>
                )}
                <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                <p className={`mt-1 text-sm ${plan.popular ? "text-blue-100" : "text-slate-500"}`}>
                  {plan.desc}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-display font-bold">£{plan.price}</span>
                  <span className={`text-sm ${plan.popular ? "text-blue-100" : "text-slate-500"}`}>/month</span>
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {Object.entries(plan.features).map(([feature, value]) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      {value === true ? (
                        <CheckCircle className={`w-4 h-4 shrink-0 ${plan.popular ? "text-blue-200" : "text-green-500"}`} />
                      ) : value === false ? (
                        <X className={`w-4 h-4 shrink-0 ${plan.popular ? "text-blue-300/50" : "text-slate-300"}`} />
                      ) : (
                        <span className={`w-4 text-center text-xs font-bold shrink-0 ${plan.popular ? "text-blue-200" : "text-primary"}`}>
                          {value}
                        </span>
                      )}
                      <span className={value === false ? (plan.popular ? "text-blue-200/60" : "text-slate-400") : ""}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    className={`w-full mt-8 ${plan.popular ? "bg-white text-primary hover:bg-blue-50" : ""}`}
                    variant={plan.popular ? "secondary" : "default"}
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            ))}
          </div>
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
