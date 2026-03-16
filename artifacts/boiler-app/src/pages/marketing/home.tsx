import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import {
  organizationSchema,
  webSiteSchema,
  softwareApplicationSchema,
} from "@/lib/schema";
import { Button } from "@/components/ui/button";
import {
  Briefcase, Users, FileText, BarChart3, Shield, Smartphone,
  CheckCircle, ArrowRight, Star, Flame, Wrench, ClipboardCheck
} from "lucide-react";

const features = [
  {
    icon: Briefcase,
    title: "Job Management",
    desc: "Create, assign, and track jobs from first call to completion. See all work at a glance.",
  },
  {
    icon: Users,
    title: "Customer Records",
    desc: "Centralised database of customers, properties, and appliance histories. Never lose a record again.",
  },
  {
    icon: FileText,
    title: "Digital Forms",
    desc: "Pre-built service records, breakdown reports, and commissioning forms. Gas Safe and OFTEC compliant.",
  },
  {
    icon: ClipboardCheck,
    title: "Digital Signatures",
    desc: "Capture customer sign-off on site. Legally valid under UK law and stored securely.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    desc: "Track revenue, job completion rates, and engineer productivity with built-in reporting.",
  },
  {
    icon: Shield,
    title: "Compliance Ready",
    desc: "Records organised by property and appliance. Ready for Gas Safe inspections at a moment's notice.",
  },
];

const stats = [
  { value: "2,500+", label: "Jobs Managed Monthly" },
  { value: "98%", label: "Customer Satisfaction" },
  { value: "5hrs", label: "Saved Per Engineer/Week" },
  { value: "4.8/5", label: "Average Rating" },
];

const plans = [
  {
    name: "Starter",
    price: "29",
    desc: "For solo engineers getting started",
    features: ["1 user", "Job management", "Digital forms", "Customer records", "Mobile access"],
  },
  {
    name: "Professional",
    price: "59",
    desc: "For growing teams",
    features: ["Up to 5 users", "Everything in Starter", "Team scheduling", "Reports & analytics", "Priority support"],
    popular: true,
  },
  {
    name: "Business",
    price: "99",
    desc: "For established companies",
    features: ["Unlimited users", "Everything in Professional", "API access", "Custom branding", "Dedicated account manager"],
  },
];

export default function HomePage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="BoilerTech — Boiler Service Management Software for Gas Engineers"
        description="The all-in-one platform for boiler service companies. Manage jobs, customers, digital forms, and compliance from one place. Start your free trial today."
        canonical={SITE_URL}
        schema={[organizationSchema(), webSiteSchema(), softwareApplicationSchema()]}
      />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-14">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Flame className="w-4 h-4" />
                Built for Gas & Oil Engineers
              </div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                Run your boiler service business{" "}
                <span className="text-primary">without the paperwork</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed">
                BoilerTech is the all-in-one platform built specifically for heating engineers.
                Manage jobs, customers, and compliance from your phone — no more paper forms,
                lost records, or missed services.
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
                    See Features
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                14-day free trial. No credit card required.
              </p>
            </div>
            <div className="shrink-0 flex items-center justify-center">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="BoilerTech"
                className="w-48 md:w-64 h-auto object-contain max-w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-display font-bold text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900">
              Everything you need to run your heating business
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Purpose-built tools for gas and oil engineers — not a generic field service app
              adapted for your trade.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg text-slate-900">{f.title}</h3>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              No long contracts. No hidden fees. Cancel anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.popular
                    ? "bg-primary text-white ring-2 ring-primary shadow-xl scale-105"
                    : "bg-white border border-slate-200"
                }`}
              >
                {plan.popular && (
                  <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 rounded-full mb-4">
                    Most Popular
                  </span>
                )}
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                <p className={`mt-1 text-sm ${plan.popular ? "text-blue-100" : "text-slate-500"}`}>
                  {plan.desc}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-display font-bold">£{plan.price}</span>
                  <span className={`text-sm ${plan.popular ? "text-blue-100" : "text-slate-500"}`}>/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`w-4 h-4 shrink-0 ${plan.popular ? "text-blue-200" : "text-green-500"}`} />
                      {f}
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

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Ready to ditch the paperwork?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Join hundreds of heating engineers who've switched to BoilerTech.
            Start your 14-day free trial today — no credit card required.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="mt-8 bg-white text-primary hover:bg-blue-50 text-base px-8 h-12"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
