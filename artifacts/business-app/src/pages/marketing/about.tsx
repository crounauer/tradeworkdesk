import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, organizationSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, Wrench, Award } from "lucide-react";

const values = [
  {
    icon: Wrench,
    title: "Built by a Tradesperson, for Tradespeople",
    desc: "TradeWorkDesk was created by a working plumber who couldn't find software that fit how the trade actually works — so we built it, for gas, oil, heat pump engineers and plumbers alike.",
  },
  {
    icon: Shield,
    title: "Compliance First",
    desc: "Every form, every workflow, every record structure is designed around UK industry regulations — Gas Safe, OFTEC, MCS, and CIPHE standards. We stay up to date so you don't have to.",
  },
  {
    icon: Users,
    title: "UK-Based Support",
    desc: "When you call us, you speak to someone who understands the heating and plumbing industry. No offshore call centres, no chatbots.",
  },
  {
    icon: Award,
    title: "Continuous Improvement",
    desc: "We ship updates every week based on feedback from real gas, oil, heat pump engineers and plumbers in the field. If something isn't working, we fix it fast.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="About TradeWorkDesk — Built for Gas, Oil, Heat Pump & Plumbing Trades"
        description="TradeWorkDesk was created by a working plumber who couldn't find job management software built for the trade. Find out why we built TradeWorkDesk and what we stand for."
        canonical={`${SITE_URL}/about`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "About", url: `${SITE_URL}/about` },
          ]),
          organizationSchema(),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-14">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
                Built by tradespeople, for tradespeople
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                TradeWorkDesk was created in 2025 by a working plumber who couldn't find job management
                software that fit how the trade actually works — so paper forms, lost records, and software
                built for other industries got replaced with something purpose-built instead.
              </p>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                TradeWorkDesk is still in active development, shaped directly by feedback from gas, oil,
                heat pump engineers and plumbers using it in the field every day.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-12">Our values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v) => (
              <div key={v.title} className="flex items-start gap-5 p-6 rounded-2xl border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-slate-900">{v.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl font-bold">Want to see what we've built?</h2>
          <p className="mt-4 text-lg text-blue-100">
            Start your 30-day free trial and explore every feature. No credit card required.
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-8 bg-white text-primary hover:bg-blue-50 text-base px-8 h-12">
              Start 30-Day Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
