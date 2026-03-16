import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, softwareApplicationSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import {
  Briefcase, Users, FileText, BarChart3, Shield, Smartphone,
  ClipboardCheck, Camera, Wifi, Wrench, Building2, ArrowRight,
  CheckCircle, Flame, Droplets, ThermometerSun
} from "lucide-react";

const featureGroups = [
  {
    title: "Job Management",
    icon: Briefcase,
    description: "From first call to completion, manage every job in one place.",
    items: [
      "Create and assign jobs to engineers",
      "Track job status in real time",
      "Schedule recurring maintenance visits",
      "Attach notes, photos, and files to any job",
      "Filter jobs by status, date, engineer, or customer",
      "Job completion reports with full audit trail",
    ],
  },
  {
    title: "Customer & Property Records",
    icon: Users,
    description: "A centralised database that follows the property, not just the person.",
    items: [
      "Customer profiles with full contact details",
      "Multiple properties per customer (ideal for landlords)",
      "Appliance tracking with make, model, and GC number",
      "Complete service history per appliance",
      "Property notes — access codes, parking, pets",
      "Quick search across all records",
    ],
  },
  {
    title: "Digital Forms & Certificates",
    icon: FileText,
    description: "Pre-built forms that meet industry standards — no customisation required.",
    items: [
      "Gas service records",
      "Breakdown reports",
      "Commissioning records (gas, oil, and heat pump)",
      "Oil tank inspections and risk assessments",
      "Combustion analysis records",
      "Fire valve and oil line vacuum tests",
      "Heat pump service and commissioning forms",
    ],
  },
  {
    title: "Digital Signatures & Photos",
    icon: ClipboardCheck,
    description: "Get customer sign-off on site and document your work visually.",
    items: [
      "Legally valid digital signatures (UK compliant)",
      "Multiple signature fields per form",
      "Photo attachments with automatic timestamps",
      "File uploads for supporting documents",
      "PDF export for customer certificates",
    ],
  },
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    description: "Understand your business with real data, not guesswork.",
    items: [
      "Jobs completed per engineer, week, and month",
      "Revenue tracking and trends",
      "Outstanding job reports",
      "Service due date reports",
      "Customer and property summaries",
      "Export data for your accountant",
    ],
  },
  {
    title: "Team Management",
    icon: Building2,
    description: "Built for teams of all sizes, from solo engineers to large firms.",
    items: [
      "Role-based access (admin, office staff, technician)",
      "Invite codes for easy team onboarding",
      "Per-engineer job assignment and tracking",
      "Company settings and branding",
      "Lookup options for custom dropdown values",
    ],
  },
];

const tradeSupport = [
  { icon: Flame, title: "Gas Boilers", desc: "Full suite of Gas Safe compliant forms" },
  { icon: Droplets, title: "Oil Boilers", desc: "OFTEC-ready inspection and service records" },
  { icon: ThermometerSun, title: "Heat Pumps", desc: "MCS-compliant commissioning and service" },
];

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Features — Boiler Service Management Tools"
        description="Explore BoilerTech's full feature set: job management, digital forms, customer records, reports, team tools, and Gas Safe compliance built for heating engineers."
        canonical={`${SITE_URL}/features`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: "Features", url: `${SITE_URL}/features` },
          ]),
          softwareApplicationSchema(),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-14">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
                Every tool a heating engineer needs, in one platform
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                BoilerTech isn't a generic field service app — it's purpose-built for gas, oil,
                and heat pump engineers working in the UK market.
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

      <section className="bg-white border-y border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tradeSupport.map((t) => (
              <div key={t.title} className="flex items-start gap-4 p-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <t.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-slate-900">{t.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          {featureGroups.map((group, i) => (
            <div
              key={group.title}
              className={`flex flex-col lg:flex-row gap-12 items-start ${
                i % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="flex-1">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <group.icon className="w-7 h-7 text-primary" />
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900">
                  {group.title}
                </h2>
                <p className="mt-3 text-slate-600 text-lg">{group.description}</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl p-8">
                <ul className="space-y-3">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            See it in action
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Start your 14-day free trial and explore every feature. No credit card required.
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
