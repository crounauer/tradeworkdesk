import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Rocket, Building2, Users, Briefcase, Receipt, Globe2, CalendarDays, Megaphone, Wrench } from "lucide-react";
import { Link } from "wouter";

type Step = {
  title: string;
  detail: string;
  href: string;
  label: string;
};

type Phase = {
  id: string;
  title: string;
  icon: React.ElementType;
  eta: string;
  steps: Step[];
};

const phases: Phase[] = [
  {
    id: "day-1-core",
    title: "Day 1: Core Setup",
    icon: Building2,
    eta: "30-45 min",
    steps: [
      {
        title: "Complete company profile",
        detail: "Set logo, contact details, business identity, address, registrations, and invoicing defaults.",
        href: "/admin/company-settings?tab=profile",
        label: "Open Company Settings",
      },
      {
        title: "Set team access and assignment",
        detail: "Invite your first team member and set assignable users from Team tab.",
        href: "/admin/company-settings?tab=team&teamTab=team",
        label: "Open Team Settings",
      },
      {
        title: "Confirm finance defaults",
        detail: "Review plan, add-ons, payments, and invoice preferences in Finance tabs.",
        href: "/admin/company-settings?tab=finance&financeTab=plans",
        label: "Open Finance",
      },
    ],
  },
  {
    id: "day-1-operations",
    title: "Day 1: Start Operating",
    icon: Briefcase,
    eta: "20-30 min",
    steps: [
      {
        title: "Add your first customer",
        detail: "Create a customer and then add at least one property and appliance for service tracking.",
        href: "/customers",
        label: "Open Customers",
      },
      {
        title: "Book your first job",
        detail: "Create a job from Dashboard or Jobs and assign the correct engineer.",
        href: "/jobs",
        label: "Open Jobs",
      },
      {
        title: "Run schedule and follow-up workflow",
        detail: "Use Schedule for planning and Follow-Ups for awaiting parts / return visits.",
        href: "/schedule",
        label: "Open Schedule",
      },
    ],
  },
  {
    id: "day-2-cashflow",
    title: "Day 2: Cashflow & Payments",
    icon: Receipt,
    eta: "20 min",
    steps: [
      {
        title: "Set up payment providers",
        detail: "Connect Stripe and/or GoCardless so payment links can be embedded in invoices.",
        href: "/admin/payment-providers",
        label: "Open Payment Providers",
      },
      {
        title: "Create and send invoice",
        detail: "Issue your first invoice and test customer payment journey end-to-end.",
        href: "/invoices",
        label: "Open Invoices",
      },
      {
        title: "Review reports",
        detail: "Check business performance from Reports and unpaid pipeline.",
        href: "/reports",
        label: "Open Reports",
      },
    ],
  },
  {
    id: "week-1-website",
    title: "Week 1: Website, Leads & Growth",
    icon: Globe2,
    eta: "45-60 min",
    steps: [
      {
        title: "Launch website",
        detail: "Configure pages, branding, forms, domain, and publish your website.",
        href: "/website",
        label: "Open Website Setup",
      },
      {
        title: "Enable lead channels",
        detail: "Configure booking, review requests, email campaigns, social posting, and missed call capture.",
        href: "/website/settings",
        label: "Open Website Settings",
      },
      {
        title: "Monitor analytics",
        detail: "Track leads plus real traffic metrics (hits, users, sessions, top pages, channels).",
        href: "/website/analytics",
        label: "Open Analytics",
      },
    ],
  },
  {
    id: "ongoing-optimisation",
    title: "Ongoing Optimisation",
    icon: Megaphone,
    eta: "Weekly",
    steps: [
      {
        title: "Maintain service operations",
        detail: "Use To-Do, Follow-Ups, Maintenance Plans and Leave & Holidays to keep delivery on track.",
        href: "/todos",
        label: "Open To-Do List",
      },
      {
        title: "Refine team and job types",
        detail: "Adjust roles, assignability, and job type catalog to match real work patterns.",
        href: "/admin/company-settings?tab=catalogue",
        label: "Open Job Types",
      },
      {
        title: "Use engineering calculators",
        detail: "Use built-in tools for sizing, siting and compliance checks.",
        href: "/tools",
        label: "Open Tools",
      },
    ],
  },
];

export default function GettingStartedPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-7 h-7 text-primary" />
            Getting Started
          </h1>
          <p className="text-muted-foreground mt-1">
            A practical launch plan to get a new heating business fully operational as quickly as possible.
          </p>
        </div>
        <Badge variant="secondary" className="h-fit">Recommended first 7 days</Badge>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            Tip: complete the phases in order. Each step links directly to the relevant screen so you can work through setup without hunting through menus.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {phases.map((phase) => {
          const Icon = phase.icon;
          return (
            <Card key={phase.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  {phase.title}
                  <Badge variant="outline" className="ml-auto">{phase.eta}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {phase.steps.map((step) => (
                  <div key={step.title} className="rounded-lg border p-3">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{step.detail}</p>
                    <Link href={step.href} className="inline-flex mt-2 text-sm text-primary hover:underline">
                      {step.label}
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Team</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Set user roles, assignability, and invite workflow before workload increases.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Use Schedule, Follow-Ups and Maintenance Plans to prevent missed visits.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Compliance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Capture job forms, files and signatures consistently for audit-ready records.</CardContent>
        </Card>
      </div>

      <Card className="p-5 text-center border-slate-200 bg-slate-50">
        <p className="text-sm text-muted-foreground">
          Need help choosing the next setup step? Visit the <Link href="/help" className="text-primary hover:underline font-medium">User Guide</Link> for detailed walkthroughs by module.
        </p>
      </Card>
    </div>
  );
}
