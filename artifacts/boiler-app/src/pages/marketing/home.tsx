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

const addons = [
  "Digital Forms & Certificates",
  "Digital Signatures",
  "Team Management",
  "Accounting Integration",
  "Social Media & AI Marketing",
  "Custom Branding",
];

export default function HomePage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="TradeWorkDesk — Job Management Software for Gas, Oil, Heat Pump Engineers & Plumbers"
        description="The all-in-one platform for heating and plumbing businesses. Manage jobs, customers, digital forms, and compliance — built for gas, oil, heat pump engineers and plumbers. Start your free trial today."
        canonical={SITE_URL}
        schema={[organizationSchema(), webSiteSchema(), softwareApplicationSchema()]}
      />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-14">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Flame className="w-4 h-4" />
                Built for Gas, Oil, Heat Pump &amp; Plumbing Engineers
              </div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                Run your trade business{" "}
                <span className="text-primary">without the paperwork</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed">
                TradeWorkDesk is the all-in-one platform built specifically for tradesmen.
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
              Purpose-built tools for gas, oil, heat pump engineers and plumbers — not a generic field service app
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
              One affordable base plan. Add only what you need. No long contracts.
            </p>
          </div>
          <div className="max-w-xl mx-auto">
            <div className="rounded-2xl bg-primary text-white p-8 shadow-xl">
              <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 rounded-full mb-4">
                Base Plan
              </span>
              <h3 className="font-display text-2xl font-bold">Everything you need to get started</h3>
              <p className="mt-2 text-blue-100 text-sm">Core tools for managing your trade business.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-display font-bold">£8.50</span>
                <span className="text-blue-100 text-lg">/month</span>
              </div>
              <p className="mt-1 text-sm text-blue-200">or £85/year (save 17%)</p>
              <ul className="mt-6 space-y-3">
                {["Job management & scheduling", "Customer & property records", "Basic reporting & dashboard", "Up to 50 jobs/month", "Mobile-friendly interface", "14-day free trial"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-200 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full mt-8 bg-white text-primary hover:bg-blue-50 font-semibold text-base py-5">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="mt-8 text-center">
              <h3 className="font-display text-lg font-semibold text-slate-900 mb-3">Supercharge with add-ons</h3>
              <p className="text-sm text-slate-600 mb-4">Pick only what you need — toggle on or off any time.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {addons.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-700">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {a}
                  </span>
                ))}
              </div>
              <Link href="/pricing">
                <Button variant="link" className="mt-4 text-primary">
                  See all add-ons & pricing <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Ready to ditch the paperwork?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Join hundreds of heating engineers who've switched to TradeWorkDesk.
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
