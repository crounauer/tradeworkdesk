import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X } from "lucide-react";

const comparisonFeatures = [
  { feature: "Gas Safe compliant service records", tradeworkdesk: true, generic: false },
  { feature: "OFTEC oil inspection forms", tradeworkdesk: true, generic: false },
  { feature: "MCS heat pump commissioning forms", tradeworkdesk: true, generic: false },
  { feature: "Plumbing job sheets", tradeworkdesk: true, generic: true },
  { feature: "Appliance-level tracking per property", tradeworkdesk: true, generic: false },
  { feature: "CP12 landlord certificate generation", tradeworkdesk: true, generic: false },
  { feature: "Annual service reminders", tradeworkdesk: true, generic: true },
  { feature: "Combustion analysis recording", tradeworkdesk: true, generic: false },
  { feature: "Job scheduling & assignment", tradeworkdesk: true, generic: true },
  { feature: "Customer & property database", tradeworkdesk: true, generic: true },
  { feature: "Digital signatures", tradeworkdesk: true, generic: true },
  { feature: "Role-based team access", tradeworkdesk: true, generic: true },
  { feature: "UK-based support team", tradeworkdesk: true, generic: false },
  { feature: "No long-term contracts", tradeworkdesk: true, generic: false },
  { feature: "Built by registered engineers", tradeworkdesk: true, generic: false },
];

const faqs = [
  {
    question: "Why choose TradeWorkDesk over a generic field service app?",
    answer:
      "Generic field service apps are built for every trade — electricians, landscapers, cleaners — and none of them well. TradeWorkDesk is purpose-built for gas, oil, heat pump engineers, and plumbers. Every form, workflow, and feature reflects UK heating and plumbing industry requirements, including Gas Safe, OFTEC, and MCS compliance. You won't need to build custom forms or work around features designed for other trades.",
  },
  {
    question: "What about apps like ServiceM8, Jobber, or Housecall Pro?",
    answer:
      "These are solid general-purpose tools, but they weren't built for the UK heating and plumbing industry. They lack pre-built Gas Safe compliant forms, OFTEC inspection records, MCS commissioning documentation, and appliance-level tracking. You'll spend time building custom templates and workarounds. TradeWorkDesk gives you all of this out of the box.",
  },
  {
    question: "Is TradeWorkDesk more expensive than generic alternatives?",
    answer:
      "TradeWorkDesk starts at just £8.50/month for the Base Plan — more affordable than most field service apps. Add only the features you need with individual add-ons. The difference is you're paying for software that works for your trade immediately, without spending hours on setup and customisation. No contracts, no hidden fees, and a 30-day free trial to prove it works for you.",
  },
  {
    question: "Can I switch to TradeWorkDesk from another platform?",
    answer:
      "Yes. You can import customer data via CSV upload, and our support team can help with data migration from your existing system. Most engineers are fully up and running within a day.",
  },
  {
    question: "What if I do multiple types of work (e.g., gas and plumbing)?",
    answer:
      "TradeWorkDesk supports gas, oil, heat pump, and general plumbing work in a single platform. You don't need separate tools for each trade — switch between Gas Safe service records, oil tank assessments, heat pump commissioning, and plumbing job sheets as needed.",
  },
  {
    question: "Does TradeWorkDesk work on mobile?",
    answer:
      "Yes. TradeWorkDesk is web-based and works on any device with a modern browser — phones, tablets, and desktops. Complete forms on site, capture photos and signatures, and sync everything when you're back online.",
  },
];

export default function AlternativesPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="TradeWorkDesk vs Generic Field Service Software — Why Purpose-Built Wins"
        description="Compare TradeWorkDesk against generic field service apps. See why gas, oil, heat pump engineers and plumbers choose purpose-built software over one-size-fits-all alternatives."
        canonical={`${SITE_URL}/alternatives`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Alternatives", url: `${SITE_URL}/alternatives` },
          ]),
          faqSchema(faqs),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
              Why heating &amp; plumbing engineers choose TradeWorkDesk
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Generic field service apps try to serve every trade and end up serving none of them properly.
              TradeWorkDesk is purpose-built for gas, oil, heat pump engineers, and plumbers —
              with compliance, forms, and workflows that understand your industry.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="text-base px-8 h-12">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline" className="text-base px-8 h-12">
                  See All Features
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-4 text-center">
            Feature comparison
          </h2>
          <p className="text-lg text-slate-600 mb-12 text-center max-w-2xl mx-auto">
            See how TradeWorkDesk compares to typical generic field service software
            on the features that matter most to heating and plumbing professionals.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-4 px-4 font-display font-semibold text-slate-900">Feature</th>
                  <th className="text-center py-4 px-4 font-display font-semibold text-primary w-40">TradeWorkDesk</th>
                  <th className="text-center py-4 px-4 font-display font-semibold text-slate-500 w-40">Generic Apps</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row) => (
                  <tr key={row.feature} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3.5 px-4 text-sm text-slate-700">{row.feature}</td>
                    <td className="py-3.5 px-4 text-center">
                      {row.tradeworkdesk ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {row.generic ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl font-bold">
            Ready to try purpose-built software?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            30-day free trial. No credit card required. Set up in under 5 minutes.
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-8 bg-white text-primary hover:bg-blue-50 text-base px-8 h-12">
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
