import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  CheckCircle, ArrowRight, Star, Flame, Wrench, ClipboardCheck, Globe
} from "lucide-react";

const securityPillars = [
  {
    title: "Data Platform",
    body: "Customer, job, and form records are stored in managed UK/EU infrastructure with encryption at rest, strict access controls, and automated backups.",
  },
  {
    title: "Web Delivery",
    body: "The website and app are delivered over HTTPS/TLS through resilient edge delivery to protect sessions and keep pages fast and available.",
  },
  {
    title: "Application Runtime",
    body: "Core API services run in isolated containers with secure environment configuration, controlled deployments, and production monitoring.",
  },
];

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
  {
    icon: Globe,
    title: "Your Own Website",
    desc: "A fully SEO-optimised business website with your own domain — built in minutes from within the app.",
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
  "Website Builder & Custom Domain",
  "Accounting Integration",
  "Social Media & AI Marketing",
  "Advanced Analytics",
  "Custom Branding",
  "Specialist Forms",
];

const UK_BADGE_SRC = "/images/proudly-uk-made-badge.png";

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  per_user_price: number | null;
  max_users: number;
  is_popular: boolean;
}

function normalisePounds(raw: number): number {
  return raw > 500 ? raw / 100 : raw;
}

function fmtPounds(raw: number): string {
  const p = normalisePounds(raw);
  return p % 1 === 0 ? `£${p}` : `£${p.toFixed(2)}`;
}

export default function HomePage() {
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/platform/plans/public"],
    queryFn: () => fetch("/api/platform/plans/public").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const featuredPlan = plans.find((p) => p.is_popular) ?? plans.find((p) => p.monthly_price > 0);
  const jobPlan    = plans.find((p) => /job.?management/i.test(p.name));
  const webPlan    = plans.find((p) => /website/i.test(p.name));
  const bundlePlan = plans.find((p) => /bundle/i.test(p.name)) ?? featuredPlan;

  const jobPlanPrice    = jobPlan    ? fmtPounds(jobPlan.monthly_price)    : "£25";
  const webPlanPrice    = webPlan    ? fmtPounds(webPlan.monthly_price)    : "£20";
  const bundlePlanPrice = bundlePlan ? fmtPounds(bundlePlan.monthly_price) : "£40";
  const bundlePerUser   = bundlePlan?.per_user_price ? fmtPounds(bundlePlan.per_user_price) : "£10";

  const basePrice = bundlePlan ? fmtPounds(bundlePlan.monthly_price) : "£40";
  const perUserPrice = bundlePlan?.per_user_price ? fmtPounds(bundlePlan.per_user_price) : "£10";
  const maxUsers = bundlePlan?.max_users ?? 2;

  return (
    <MarketingLayout>
      <SEOHead
        title="TradeWorkDesk — Job Management Software for Gas, Oil, Heat Pump Engineers & Plumbers"
        description="The all-in-one platform for heating and plumbing businesses. Manage jobs, customers, digital forms, and compliance — built for gas, oil, heat pump engineers and plumbers. Start your 30-day free trial today."
        canonical={SITE_URL}
        schema={[organizationSchema(), webSiteSchema(), softwareApplicationSchema()]}
      />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-14">
            <div className="flex-1 min-w-0">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Proudly UK Made
              </p>
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
                    Start 30-Day Free Trial
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
                30-day free trial. No credit card required.
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

      <section className="bg-slate-50 py-16 md:py-20 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <div className="mb-4 flex items-center gap-2">
              <img
                src={UK_BADGE_SRC}
                alt="Proudly UK Made"
                className="h-10 w-10 object-contain opacity-90"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Proudly UK Made</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900">
              Security and reliability built into every layer
            </h2>
            <p className="mt-3 text-slate-600">
              From data storage to web delivery and API operations, the platform is designed to protect records and keep services dependable.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {securityPillars.map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Full details are available in our Privacy Policy.
          </p>
        </div>
      </section>

      {/* Website builder spotlight */}
      <section className="bg-slate-900 py-20 md:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/20 text-teal-400 text-sm font-medium mb-6">
                <Globe className="w-4 h-4" />
                Included in every plan
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
                A professional website, live in minutes
              </h2>
              <p className="mt-4 text-lg text-slate-300 leading-relaxed">
                TradeWorkDesk includes a full website builder. Choose your pages, click
                &ldquo;Build My Website&rdquo; and get an SEO-optimised site with your own domain — no
                developer needed.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "7 pre-built pages — Home, Services, How It Works, Projects, Reviews, Areas, Contact",
                  "Block-based editor — hero, FAQ, testimonials, gallery, case studies and more",
                  "Custom domain with automatic SSL",
                  "Structured data (LocalBusiness, FAQPage, BreadcrumbList) built in",
                  "Automatic XML sitemap and robots.txt",
                  "Upload and optimise images from within the editor",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/register">
                  <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-white text-base px-8 h-12">
                    Start 30-Day Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            {/* Illustration / feature cards */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
              {[
                { label: "Block Editor", desc: "Drag-and-drop blocks — hero, FAQ, testimonials, gallery, contact form and more" },
                { label: "SEO Built In", desc: "Schema markup, canonical URLs, and sitemaps generated automatically" },
                { label: "Custom Domain", desc: "Connect your own domain with one click and automatic SSL" },
                { label: "Image Library", desc: "Upload images directly in the editor — auto-converted to WebP for speed" },
              ].map((card) => (
                <div key={card.label} className="rounded-xl bg-slate-800 border border-slate-700 p-5">
                  <p className="font-semibold text-white text-sm mb-2">{card.label}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Start with job management, the website builder, or get both together — your choice.
            </p>
          </div>

          {/* Three plan summary cards */}
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {/* Job Management */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <Briefcase className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-display font-bold text-lg text-slate-900">Job Management</h3>
              <p className="text-sm text-slate-500 mt-1">Run jobs, customers, invoicing and compliance from one place.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-slate-900">{jobPlanPrice}</span>
                <span className="text-slate-500 text-sm">/mo</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">incl. 2 users</p>
            </div>

            {/* Bundle */}
            <div className="rounded-xl border-2 border-primary bg-primary text-white p-6 relative shadow-lg">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                Most popular
              </span>
              <Globe className="w-5 h-5 text-blue-200 mb-3" />
              <h3 className="font-display font-bold text-lg text-white">Bundle</h3>
              <p className="text-sm text-blue-100 mt-1">Job Management + Website Builder at a discounted price.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-white">{bundlePlanPrice}</span>
                <span className="text-blue-200 text-sm">/mo</span>
              </div>
              <p className="text-xs text-blue-300 mt-1">incl. 2 users &nbsp;·&nbsp; + {bundlePerUser}/mo per extra user</p>
            </div>

            {/* Website Builder */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <Globe className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-display font-bold text-lg text-slate-900">Website Builder</h3>
              <p className="text-sm text-slate-500 mt-1">Professional trade website with custom domain, blog and contact forms.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-slate-900">{webPlanPrice}</span>
                <span className="text-slate-500 text-sm">/mo</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">incl. 1 user</p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            All prices exclude VAT. 30-day free trial on every plan — no credit card required.
          </div>

          <div className="mt-8 text-center">
            <Link href="/pricing">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                Compare all plans in detail <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <div className="mb-5 flex justify-center">
            <img
              src={UK_BADGE_SRC}
              alt="Proudly UK Made"
              className="h-12 w-12 object-contain opacity-95"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Ready to ditch the paperwork?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Join hundreds of heating engineers who've switched to TradeWorkDesk.
            Start your 30-day free trial today — no credit card required.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="mt-8 bg-white text-primary hover:bg-blue-50 text-base px-8 h-12"
            >
              Start 30-Day Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
