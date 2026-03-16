import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";

interface TradePageConfig {
  slug: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  features: string[];
  faqs: { question: string; answer: string }[];
}

const tradePages: Record<string, TradePageConfig> = {
  "gas-engineer-software": {
    slug: "gas-engineer-software",
    h1: "Software Built for Gas Engineers",
    title: "Gas Engineer Software — Job Management for Gas Safe Engineers",
    description:
      "Purpose-built job management software for Gas Safe registered engineers. Digital service records, breakdown reports, commissioning forms, and compliance tools.",
    intro:
      "BoilerTech is built specifically for Gas Safe registered engineers. Every form, workflow, and feature is designed around how gas engineers actually work — not adapted from a generic field service tool.",
    features: [
      "Gas Safe compliant service records and breakdown reports",
      "Commissioning forms for new boiler installations",
      "Combustion analysis and flue gas recording",
      "Fire valve test and oil line vacuum test forms",
      "Digital signatures — legally valid under UK law",
      "Customer and property records organised by appliance",
      "Complete audit trail for Gas Safe inspections",
      "Works on mobile — even in boiler cupboards with poor signal",
      "Job scheduling, assignment, and tracking",
      "Reports for revenue, jobs completed, and overdue services",
    ],
    faqs: [
      {
        question: "Is BoilerTech approved by Gas Safe?",
        answer:
          "BoilerTech produces records that are accepted by Gas Safe Register during inspections. Our forms are designed to capture all the data points required by current regulations.",
      },
      {
        question: "Can I use BoilerTech for CP12 landlord certificates?",
        answer:
          "Yes. Service records created in BoilerTech can be exported as PDFs suitable for landlord gas safety certificates. All required fields are included.",
      },
      {
        question: "Does it work offline?",
        answer:
          "BoilerTech is a web-based application that works on any device with a browser. For areas with limited signal, forms can be completed and submitted once connectivity is restored.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Plans start at £29/month for solo engineers. No contracts, no hidden fees. Start with a 14-day free trial — no credit card required.",
      },
    ],
  },
  "boiler-service-management-software": {
    slug: "boiler-service-management-software",
    h1: "Boiler Service Management Software",
    title: "Boiler Service Management Software — Manage Your Heating Business",
    description:
      "All-in-one boiler service management software for heating companies. Track jobs, manage customers, generate reports, and stay Gas Safe compliant.",
    intro:
      "Running a boiler service company means juggling jobs, customers, compliance, and paperwork every single day. BoilerTech brings it all together in one platform, so you can focus on the work that matters.",
    features: [
      "Full job lifecycle management — from booking to completion",
      "Customer database with property and appliance tracking",
      "Annual service scheduling and reminders",
      "Digital service records, breakdown reports, and commissioning forms",
      "Team management with role-based access",
      "Revenue and job completion reporting",
      "Quick search across all customers, properties, and jobs",
      "Digital signatures and photo documentation",
      "Compliance-ready records for Gas Safe inspections",
      "No contracts — monthly billing, cancel anytime",
    ],
    faqs: [
      {
        question: "Can I manage multiple engineers?",
        answer:
          "Yes. The Professional plan supports up to 5 users and the Business plan offers unlimited users. You can assign jobs to specific engineers, track their workload, and manage team access with different role levels.",
      },
      {
        question: "Can I import my existing customer data?",
        answer:
          "Yes. You can import customer data via CSV upload. Our support team can also help you migrate data from your existing system.",
      },
      {
        question: "Is my data backed up?",
        answer:
          "Yes. All data is automatically backed up and stored securely in UK/EU data centres. We maintain multiple backups to ensure your records are never lost.",
      },
      {
        question: "Do I need to install anything?",
        answer:
          "No. BoilerTech is web-based and works in any modern browser — Chrome, Safari, Firefox, or Edge. No app to download, no software to install.",
      },
    ],
  },
  "job-management-software-heating-engineers": {
    slug: "job-management-software-heating-engineers",
    h1: "Job Management Software for Heating Engineers",
    title: "Job Management Software for Heating Engineers — Track Every Job",
    description:
      "Purpose-built job management software for heating engineers. Create, assign, schedule, and track boiler service jobs from your phone.",
    intro:
      "Most job management software wasn't built for heating engineers. BoilerTech was. Every feature is designed around the daily workflow of gas, oil, and heat pump engineers working in the UK market.",
    features: [
      "Create and assign jobs in seconds",
      "Track job status — scheduled, in progress, completed",
      "Attach service records, photos, and signatures to jobs",
      "Link jobs to specific customers, properties, and appliances",
      "Schedule recurring annual services",
      "Job completion reports with full audit trail",
      "Filter and search jobs by date, status, or engineer",
      "Mobile-friendly — manage jobs from your phone",
      "Multi-engineer support with team scheduling",
      "Integration with digital forms for gas, oil, and heat pump work",
    ],
    faqs: [
      {
        question: "How is this different from a generic job management app?",
        answer:
          "Generic apps don't understand heating industry requirements. BoilerTech includes pre-built gas service forms, appliance tracking, Gas Safe compliant records, and workflows designed specifically for how heating engineers work.",
      },
      {
        question: "Can my office staff use it too?",
        answer:
          "Yes. BoilerTech has role-based access — admins and office staff can create and manage jobs, while technicians see their assigned work and complete forms on site.",
      },
      {
        question: "Can I see all my engineers' jobs at once?",
        answer:
          "Yes. The dashboard gives you a real-time overview of all jobs across your team, filterable by status, date, and engineer.",
      },
      {
        question: "Is there a limit on the number of jobs?",
        answer:
          "No. All plans include unlimited jobs. Whether you complete 10 jobs a week or 100, the pricing stays the same.",
      },
    ],
  },
};

export default function TradeLandingPage({ slug }: { slug: string }) {
  const config = tradePages[slug];
  if (!config) return null;

  return (
    <MarketingLayout>
      <SEOHead
        title={config.title}
        description={config.description}
        canonical={`${SITE_URL}/${config.slug}`}
        schema={[
          breadcrumbSchema([
            { name: "Home", url: SITE_URL },
            { name: config.h1, url: `${SITE_URL}/${config.slug}` },
          ]),
          faqSchema(config.faqs),
        ]}
      />

      <section className="bg-gradient-to-br from-slate-50 to-white py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900">
              {config.h1}
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">{config.intro}</p>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-10">
            What you get
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {config.features.map((f) => (
              <div key={f} className="flex items-start gap-3 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-slate-700">{f}</span>
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
            {config.faqs.map((faq) => (
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
            Ready to get started?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            14-day free trial. No credit card required. Set up in under 5 minutes.
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
