import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, Droplets, Wind, Wrench, Building2, User, Users } from "lucide-react";

const tradePages = [
  {
    title: "Gas Engineer Software",
    href: "/gas-engineer-software",
    icon: Flame,
    description: "Purpose-built for Gas Safe registered engineers. Digital service records, breakdown reports, commissioning forms, and full compliance tools for domestic and commercial gas work.",
  },
  {
    title: "Oil Engineer Software",
    href: "/oil-engineer-software",
    icon: Droplets,
    description: "Designed for OFTEC registered oil engineers. Tank inspections, service records, commissioning documentation, and fire valve testing — all in one platform.",
  },
  {
    title: "Heat Pump Engineer Software",
    href: "/heat-pump-engineer-software",
    icon: Wind,
    description: "Built for MCS certified heat pump installers and service engineers. Commissioning forms, performance logging, and maintenance records for ASHP and GSHP systems.",
  },
  {
    title: "Plumber Software",
    href: "/plumber-software",
    icon: Wrench,
    description: "Job management for general plumbers. Bathroom installs, leak repairs, unvented cylinders, commercial maintenance — with digital job sheets and customer records.",
  },
  {
    title: "Boiler Service Management Software",
    href: "/boiler-service-management-software",
    icon: Flame,
    description: "All-in-one software for boiler service companies. Track the full job lifecycle, manage customers and appliances, and stay compliant with Gas Safe and OFTEC requirements.",
  },
  {
    title: "Job Management for Heating Engineers",
    href: "/job-management-software-heating-engineers",
    icon: Flame,
    description: "Create, assign, schedule, and track jobs from your phone. Built specifically for the daily workflow of heating engineers across gas, oil, and heat pump work.",
  },
];

const audiencePages = [
  {
    title: "Landlord Gas Safety Software",
    href: "/landlord-gas-safety-software",
    icon: Building2,
    description: "Manage CP12 certificates, schedule annual safety checks across property portfolios, and keep landlords and letting agents informed — all from one platform.",
  },
  {
    title: "Sole Trader Software",
    href: "/sole-trader-software",
    icon: User,
    description: "Affordable job management for one-person businesses. All the tools you need — digital forms, customer records, scheduling, and compliance — at a price that works for sole traders.",
  },
  {
    title: "Heating Company Software",
    href: "/heating-company-software",
    icon: Users,
    description: "Team management for multi-engineer businesses. Job assignment, role-based access, workload balancing, and company-wide reporting for heating and plumbing companies.",
  },
];

const allPages = [...tradePages, ...audiencePages];

export default function IndustriesPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Industries We Serve — Gas, Oil, Heat Pump & Plumbing Software"
        description="TradeWorkDesk serves gas engineers, oil engineers, heat pump installers, and general plumbers. Explore our trade-specific and audience-specific software solutions."
        canonical={`${SITE_URL}/industries`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Industries", url: `${SITE_URL}/industries` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Industries Served by TradeWorkDesk",
            description: "Trade-specific and audience-specific job management software for the UK heating and plumbing industry.",
            url: `${SITE_URL}/industries`,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: allPages.map((page, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: page.title,
                url: `${SITE_URL}${page.href}`,
              })),
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "TradeWorkDesk",
            provider: {
              "@type": "Organization",
              name: "TradeWorkDesk",
              url: SITE_URL,
            },
            description: "Job management software for the UK heating and plumbing industry, serving gas, oil, heat pump engineers, and general plumbers.",
            serviceType: "Software as a Service",
          },
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
              Software for every heating &amp; plumbing trade
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              TradeWorkDesk is purpose-built for the trades that keep the UK warm and the water flowing.
              Whether you're a Gas Safe registered engineer, OFTEC oil specialist, MCS certified heat pump installer,
              or a general plumber — we've built features specifically for the way you work.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">
            Trade-specific solutions
          </h2>
          <p className="text-lg text-slate-600 mb-12 max-w-2xl">
            Every trade has unique compliance requirements, workflows, and terminology.
            Our software reflects that — not a generic tool with your trade bolted on.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tradePages.map((page) => (
              <Link key={page.href} href={page.href}>
                <div className="group h-full p-6 rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <page.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors">
                    {page.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{page.description}</p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary">
                    Learn more <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">
            Solutions by business type
          </h2>
          <p className="text-lg text-slate-600 mb-12 max-w-2xl">
            Whether you're a sole trader, a landlord gas safety specialist, or running a multi-engineer company —
            TradeWorkDesk scales to fit your business.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {audiencePages.map((page) => (
              <Link key={page.href} href={page.href}>
                <div className="group h-full p-6 rounded-2xl border border-slate-200 bg-white hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <page.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors">
                    {page.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{page.description}</p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary">
                    Learn more <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl font-bold">
            Ready to try software built for your trade?
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
