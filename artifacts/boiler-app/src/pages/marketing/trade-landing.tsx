import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { SEOHead, SITE_URL } from "@/components/seo-head";
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Shield } from "lucide-react";

interface TradePageConfig {
  slug: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  features: string[];
  credentials: { body: string; label: string }[];
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
      "TradeWorkDesk is built specifically for Gas Safe registered engineers. Every form, workflow, and feature is designed around how gas engineers actually work — not adapted from a generic field service tool.",
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
    credentials: [
      { label: "Gas Safe Register", body: "Our forms capture every data point required by Gas Safe Register inspections, including appliance details, flue readings, and safety device checks." },
      { label: "Industry Compliance", body: "All digital service records, breakdown reports, and commissioning forms are designed to meet current UK gas safety regulations." },
      { label: "Built by Registered Engineers", body: "TradeWorkDesk was founded by a Gas Safe registered engineer with 15+ years of hands-on experience in domestic and commercial gas work." },
    ],
    faqs: [
      {
        question: "Is TradeWorkDesk approved by Gas Safe?",
        answer:
          "TradeWorkDesk produces records that are accepted by Gas Safe Register during inspections. Our forms are designed to capture all the data points required by current regulations.",
      },
      {
        question: "Can I use TradeWorkDesk for CP12 landlord certificates?",
        answer:
          "Yes. Service records created in TradeWorkDesk can be exported as PDFs suitable for landlord gas safety certificates. All required fields are included.",
      },
      {
        question: "Does it work offline?",
        answer:
          "TradeWorkDesk is a web-based application that works on any device with a browser. For areas with limited signal, forms can be completed and submitted once connectivity is restored.",
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
      "Running a boiler service company means juggling jobs, customers, compliance, and paperwork every single day. TradeWorkDesk brings it all together in one platform, so you can focus on the work that matters.",
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
    credentials: [
      { label: "Gas Safe Register", body: "Service records and compliance documentation designed around Gas Safe Register requirements for domestic and commercial gas work." },
      { label: "OFTEC", body: "Oil boiler service and inspection records aligned with OFTEC standards for oil-fired appliance maintenance." },
      { label: "Built by Industry Professionals", body: "Created by a team that includes Gas Safe and OFTEC registered engineers who understand the compliance demands of running a heating business." },
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
          "No. TradeWorkDesk is web-based and works in any modern browser — Chrome, Safari, Firefox, or Edge. No app to download, no software to install.",
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
      "Most job management software wasn't built for heating engineers. TradeWorkDesk was. Every feature is designed around the daily workflow of gas, oil, and heat pump engineers working in the UK market.",
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
    credentials: [
      { label: "Gas Safe Register", body: "Pre-built forms aligned with Gas Safe inspection requirements for domestic and commercial gas installations and servicing." },
      { label: "OFTEC", body: "Oil heating workflows designed around OFTEC compliance standards for oil-fired appliance installation and maintenance." },
      { label: "MCS (Microgeneration Certification Scheme)", body: "Heat pump commissioning and service records structured to support MCS certification requirements." },
    ],
    faqs: [
      {
        question: "How is this different from a generic job management app?",
        answer:
          "Generic apps don't understand heating industry requirements. TradeWorkDesk includes pre-built gas service forms, appliance tracking, Gas Safe compliant records, and workflows designed specifically for how heating engineers work.",
      },
      {
        question: "Can my office staff use it too?",
        answer:
          "Yes. TradeWorkDesk has role-based access — admins and office staff can create and manage jobs, while technicians see their assigned work and complete forms on site.",
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
  "oil-engineer-software": {
    slug: "oil-engineer-software",
    h1: "Software Built for Oil Engineers",
    title: "Oil Engineer Software — Job Management for OFTEC Engineers",
    description:
      "Purpose-built job management software for OFTEC registered oil engineers. Digital inspection records, service forms, tank assessments, and compliance tools.",
    intro:
      "TradeWorkDesk is designed for OFTEC registered oil heating engineers. From tank inspections and service records to commissioning forms and compliance documentation — every workflow reflects how oil engineers actually work in the field.",
    features: [
      "OFTEC-compliant service and inspection records",
      "Oil tank condition assessment forms",
      "Fire valve and oil line vacuum test documentation",
      "Commissioning forms for oil boiler installations",
      "Digital signatures — legally valid under UK law",
      "Customer and property records organised by appliance",
      "Complete audit trail for OFTEC inspections",
      "Works on mobile — even in rural locations with poor signal",
      "Job scheduling, assignment, and tracking",
      "Reports for revenue, jobs completed, and overdue services",
    ],
    credentials: [
      { label: "OFTEC (Oil Firing Technical Association)", body: "All inspection and service records are structured around OFTEC compliance requirements, including CD/11 and CD/12 equivalent documentation." },
      { label: "Industry Standards", body: "Tank condition assessments, fire valve tests, and oil line vacuum tests follow current UK industry standards for oil-fired heating installations." },
      { label: "Built by Registered Engineers", body: "Our founder holds both Gas Safe and OFTEC registrations, ensuring oil heating workflows reflect real-world inspection and servicing requirements." },
    ],
    faqs: [
      {
        question: "Does TradeWorkDesk support OFTEC documentation?",
        answer:
          "Yes. TradeWorkDesk includes forms and record structures designed to meet OFTEC inspection requirements, including CD/11 and CD/12 equivalent records, tank condition assessments, and commissioning documentation.",
      },
      {
        question: "Can I record oil tank inspection details?",
        answer:
          "Yes. You can document tank type, condition, bund status, oil line routing, fire valve position, and all other details required for a thorough oil tank assessment.",
      },
      {
        question: "Is it suitable for rural areas with poor mobile signal?",
        answer:
          "TradeWorkDesk is web-based and works on any device with a browser. Forms can be completed on site and submitted once connectivity is restored, making it ideal for rural oil heating work.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Plans start at £29/month for solo engineers. No contracts, no hidden fees. Start with a 14-day free trial — no credit card required.",
      },
    ],
  },
  "heat-pump-engineer-software": {
    slug: "heat-pump-engineer-software",
    h1: "Software Built for Heat Pump Engineers",
    title: "Heat Pump Engineer Software — Job Management for MCS Engineers",
    description:
      "Purpose-built job management software for MCS certified heat pump engineers. Digital commissioning forms, service records, performance logging, and compliance tools.",
    intro:
      "TradeWorkDesk supports MCS certified heat pump installers and service engineers. From air source and ground source commissioning to ongoing maintenance records — every workflow is built around heat pump industry requirements.",
    features: [
      "MCS-compliant commissioning and handover documentation",
      "Heat pump service and maintenance records",
      "Performance data logging (COP, flow temps, refrigerant pressures)",
      "Air source and ground source heat pump support",
      "Digital signatures — legally valid under UK law",
      "Customer and property records with system specifications",
      "Complete audit trail for MCS and manufacturer inspections",
      "Works on mobile — complete forms on site",
      "Job scheduling, assignment, and tracking",
      "Reports for revenue, jobs completed, and overdue services",
    ],
    credentials: [
      { label: "MCS (Microgeneration Certification Scheme)", body: "Commissioning forms, handover documentation, and service records are structured to meet MCS certification requirements for renewable heating installations." },
      { label: "Manufacturer Standards", body: "Performance data logging supports COP readings, flow temperatures, and refrigerant pressures aligned with manufacturer commissioning requirements." },
      { label: "Built with Industry Input", body: "Our development team works closely with MCS certified heat pump installers to ensure every workflow reflects current installation and servicing best practices." },
    ],
    faqs: [
      {
        question: "Does TradeWorkDesk support MCS documentation?",
        answer:
          "Yes. TradeWorkDesk includes commissioning forms, handover packs, and service records designed to meet MCS certification requirements. All mandatory data points for MCS inspections are captured.",
      },
      {
        question: "Can I log heat pump performance data?",
        answer:
          "Yes. You can record COP readings, flow and return temperatures, refrigerant pressures, and other performance metrics as part of service records, building a performance history for each installation.",
      },
      {
        question: "Does it handle both air source and ground source heat pumps?",
        answer:
          "Yes. TradeWorkDesk supports both ASHP and GSHP installations, with appropriate form fields for each system type including borehole details, collector loop specifications, and defrost cycle records.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Plans start at £29/month for solo engineers. No contracts, no hidden fees. Start with a 14-day free trial — no credit card required.",
      },
    ],
  },
  "plumber-software": {
    slug: "plumber-software",
    h1: "Software Built for Plumbers",
    title: "Plumber Software — Job Management for Plumbing Businesses",
    description:
      "Purpose-built job management software for plumbers. Track bathroom installs, leak repairs, unvented cylinders, and all plumbing work with digital forms and customer records.",
    intro:
      "TradeWorkDesk isn't just for heating engineers — it's built for general plumbers too. Whether you're fitting bathrooms, repairing leaks, installing unvented cylinders, or maintaining commercial plumbing systems, every feature works for your trade.",
    features: [
      "Job management for all plumbing work types",
      "Digital job sheets and completion reports",
      "Customer and property records with full job history",
      "Photo documentation for before/after evidence",
      "Unvented hot water cylinder records (G3 qualified work)",
      "Digital signatures — legally valid under UK law",
      "Quote and invoice tracking",
      "Works on mobile — complete forms on site",
      "Job scheduling, assignment, and tracking",
      "Reports for revenue, jobs completed, and outstanding work",
    ],
    credentials: [
      { label: "CIPHE (Chartered Institute of Plumbing and Heating Engineering)", body: "TradeWorkDesk helps maintain professional documentation standards aligned with CIPHE expectations for qualified plumbers." },
      { label: "G3 Unvented Hot Water", body: "Dedicated record structures for G3-qualified unvented hot water cylinder work, including installation records, safety device checks, and annual service documentation." },
      { label: "Built by Trade Professionals", body: "Our team includes experienced plumbing and heating professionals who understand the documentation and compliance needs of general plumbing businesses." },
    ],
    faqs: [
      {
        question: "Is TradeWorkDesk suitable for general plumbing, not just heating?",
        answer:
          "Absolutely. While TradeWorkDesk has deep features for heating work, it's equally effective for general plumbing — bathroom installs, leak repairs, waste systems, rainwater harvesting, and commercial plumbing maintenance.",
      },
      {
        question: "Can I track unvented cylinder work?",
        answer:
          "Yes. TradeWorkDesk supports documentation for G3-qualified unvented hot water work, including installation records, safety device checks, and annual service documentation.",
      },
      {
        question: "Does it support CIPHE membership records?",
        answer:
          "TradeWorkDesk helps you maintain professional records that demonstrate competence to bodies like CIPHE (Chartered Institute of Plumbing and Heating Engineering), with complete job histories and documentation trails.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Plans start at £29/month for solo plumbers. No contracts, no hidden fees. Start with a 14-day free trial — no credit card required.",
      },
    ],
  },
  "landlord-gas-safety-software": {
    slug: "landlord-gas-safety-software",
    h1: "Landlord Gas Safety Certificate Software",
    title: "Landlord Gas Safety Software — CP12 Certificates & Annual Checks",
    description:
      "Software for managing landlord gas safety certificates (CP12s), annual safety checks, and multi-property portfolios. Built for gas engineers serving landlords and letting agents.",
    intro:
      "If you carry out landlord gas safety checks, TradeWorkDesk streamlines the entire process. Manage CP12 certificates, schedule annual checks across property portfolios, and keep landlords and letting agents informed — all from one platform.",
    features: [
      "CP12 landlord gas safety certificate generation",
      "Annual service scheduling with automatic reminders",
      "Multi-property portfolio management",
      "Landlord and letting agent contact management",
      "Appliance-level records per property",
      "PDF certificate export for landlord records",
      "Overdue check alerts and compliance tracking",
      "Digital signatures — legally valid under UK law",
      "Bulk scheduling for property portfolios",
      "Complete audit trail for Gas Safe inspections",
    ],
    credentials: [
      { label: "Gas Safe Register", body: "CP12 landlord gas safety records capture all data points required by Gas Safe Register, including appliance details, flue readings, safety device checks, and engineer sign-off." },
      { label: "Regulatory Compliance", body: "Records meet the requirements of the Gas Safety (Installation and Use) Regulations 1998 for landlord gas safety checks on rented properties." },
      { label: "Built by Gas Engineers", body: "Our founder has over 15 years of experience carrying out landlord gas safety checks and understands the documentation and scheduling demands of portfolio work." },
    ],
    faqs: [
      {
        question: "Can I generate CP12 certificates with TradeWorkDesk?",
        answer:
          "Yes. TradeWorkDesk produces digital landlord gas safety records (CP12s) capturing all required data points including appliance details, flue readings, safety device checks, and engineer sign-off. Records can be exported as PDFs for landlords.",
      },
      {
        question: "How does the annual reminder system work?",
        answer:
          "TradeWorkDesk tracks the anniversary date of every landlord gas safety check. You receive alerts when checks are approaching due, and you can schedule them in bulk across an entire property portfolio.",
      },
      {
        question: "Can landlords or letting agents access their certificates?",
        answer:
          "You can export completed CP12 certificates as PDFs and send them directly to landlords or letting agents. All records are stored permanently for your compliance records.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Plans start at £29/month for solo engineers. No contracts, no hidden fees. Start with a 14-day free trial — no credit card required.",
      },
    ],
  },
  "sole-trader-software": {
    slug: "sole-trader-software",
    h1: "Software for Sole Trader Engineers & Plumbers",
    title: "Sole Trader Software — Affordable Job Management for One-Person Businesses",
    description:
      "Affordable job management software for sole trader gas engineers, oil engineers, heat pump installers, and plumbers. All the tools you need at a price that works for a one-person business.",
    intro:
      "You don't need enterprise software to run a professional trade business. TradeWorkDesk's Starter plan gives sole trader engineers and plumbers everything they need — job management, digital forms, customer records, and compliance tools — at a price that makes sense for a one-person operation.",
    features: [
      "Full job management for a single user",
      "All digital forms — service records, breakdown reports, commissioning",
      "Customer and property database",
      "Annual service reminders and scheduling",
      "Digital signatures and photo documentation",
      "PDF export for customer records and certificates",
      "Revenue and job completion reporting",
      "Works on mobile — your office in your pocket",
      "No contracts — monthly billing, cancel anytime",
      "14-day free trial, no credit card required",
    ],
    credentials: [
      { label: "Gas Safe, OFTEC & MCS Compliance", body: "All compliant forms are included on every plan — Gas Safe service records, OFTEC inspection forms, and MCS commissioning documentation are never a premium add-on." },
      { label: "Affordable Professional Tools", body: "The Starter plan at £29/month includes every compliance feature and digital form, so sole traders get the same professional tools as larger companies." },
      { label: "Built for One-Person Businesses", body: "Designed by a founder who started as a sole trader and knows that affordability and simplicity are essential for independent engineers and plumbers." },
    ],
    faqs: [
      {
        question: "Is the Starter plan genuinely enough for a sole trader?",
        answer:
          "Yes. The Starter plan at £29/month includes unlimited jobs, all digital forms, customer records, scheduling, and reporting. The only limits are on user count (1 user) and some advanced team features you don't need as a sole trader.",
      },
      {
        question: "Can I upgrade later if I take on staff?",
        answer:
          "Absolutely. You can upgrade to Professional (up to 5 users) or Business (unlimited users) at any time. All your data carries over — no migration needed.",
      },
      {
        question: "Do I still get compliance features on the Starter plan?",
        answer:
          "Yes. Gas Safe, OFTEC, and MCS compliant forms are included on every plan. Compliance isn't a premium feature — it's fundamental to every trade.",
      },
      {
        question: "Is there a discount for annual billing?",
        answer:
          "We keep things simple with monthly billing and no contracts. You pay £29/month and can cancel anytime — no annual commitment required.",
      },
    ],
  },
  "heating-company-software": {
    slug: "heating-company-software",
    h1: "Software for Heating & Plumbing Companies",
    title: "Heating Company Software — Team Management for Multi-Engineer Businesses",
    description:
      "Job management software for heating and plumbing companies with multiple engineers. Team scheduling, job assignment, role-based access, and business reporting.",
    intro:
      "Running a multi-engineer heating or plumbing company means coordinating teams, tracking jobs across sites, and keeping everyone on the same page. TradeWorkDesk gives you the tools to manage your entire operation — from job assignment and team scheduling to compliance oversight and business reporting.",
    features: [
      "Multi-engineer team management",
      "Job assignment and workload balancing",
      "Role-based access — admin, office staff, and technician roles",
      "Real-time job status tracking across all engineers",
      "Company-wide reporting — revenue, jobs, and performance",
      "Centralised customer and property database",
      "Compliance oversight — track certifications and form completion",
      "Digital forms for gas, oil, heat pump, and plumbing work",
      "Unlimited jobs on all team plans",
      "No per-job fees — flat monthly pricing",
    ],
    credentials: [
      { label: "Gas Safe & OFTEC Compliance", body: "All gas and oil compliance forms are included, so your team produces consistent, regulation-ready documentation across every engineer." },
      { label: "MCS Certification Support", body: "Heat pump commissioning and service records meet MCS requirements, supporting companies that operate across multiple fuel types." },
      { label: "Built for Growing Businesses", body: "Designed with input from multi-engineer heating and plumbing companies who need role-based access, team oversight, and consistent compliance across their workforce." },
    ],
    faqs: [
      {
        question: "How many engineers can use TradeWorkDesk?",
        answer:
          "The Professional plan supports up to 5 users and the Business plan offers unlimited users. Each engineer gets their own login with appropriate access levels.",
      },
      {
        question: "Can office staff manage jobs without going on site?",
        answer:
          "Yes. Admin and office roles can create jobs, assign them to engineers, manage customer records, and run reports from the office. Technician roles see their assigned work and complete forms on site.",
      },
      {
        question: "Can I see what all my engineers are doing in real time?",
        answer:
          "Yes. The dashboard shows all active jobs across your team with status updates. You can filter by engineer, date, job type, or status to see exactly where work stands.",
      },
      {
        question: "How much does it cost for a team?",
        answer:
          "The Professional plan (up to 5 users) is £59/month. The Business plan (unlimited users) is £99/month. No contracts, no per-user fees beyond the plan limit. Start with a 14-day free trial.",
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
          softwareApplicationSchema(),
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

      <section className="bg-white py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">
            Credentials &amp; industry standards
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl">
            TradeWorkDesk is built around the compliance and documentation standards that matter to your trade.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {config.credentials.map((cred) => (
              <div key={cred.label} className="flex items-start gap-4 p-6 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-slate-900">{cred.label}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{cred.body}</p>
                </div>
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
