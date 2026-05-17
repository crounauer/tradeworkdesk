import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import {
  ChevronDown, ChevronRight, BookOpen, Rocket, Users,
  Briefcase, CalendarDays, Receipt, CreditCard, ShieldCheck,
  UserCog, HelpCircle, CheckCircle2, Wrench, Settings2,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type HelpItem = { q: string; a: string | React.ReactNode };
type HelpSection = {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  roles?: string[];
  items: HelpItem[];
};

const sections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    color: "text-blue-600 bg-blue-50",
    roles: ["admin", "office_staff", "super_admin"],
    items: [
      {
        q: "What should I do first?",
        a: (
          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
            <li>Go to <strong>Admin → Company Settings</strong> and fill in your business details</li>
            <li>Add your first <strong>Customer</strong> (Customers menu)</li>
            <li>Add a <strong>Property</strong> for that customer</li>
            <li>Book your first <strong>Job</strong> using the + Book Job button on the dashboard</li>
            <li>Set up <strong>payments</strong> if you want to take card or direct debit payments</li>
          </ol>
        ),
      },
      {
        q: "How do I invite my team?",
        a: "Go to Admin → Invite Codes. Generate an invite code and share the link with your engineers or office staff. They sign up using that code and are automatically linked to your company.",
      },
      {
        q: "What is the difference between Admin, Office Staff, and Technician roles?",
        a: "Admin can access everything including billing and settings. Office Staff can manage customers, jobs, and invoices but not billing or company settings. Technicians only see jobs assigned to them and can add service records.",
      },
      {
        q: "How do I set up my company logo and details?",
        a: "Go to Admin → Company Settings. You can upload a logo, set your company name, address, phone and email. These appear on invoices sent to your customers.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: BookOpen,
    color: "text-slate-600 bg-slate-100",
    items: [
      {
        q: "What does the dashboard show?",
        a: "Today's scheduled jobs, upcoming jobs for the next 7 days, and summary stats (jobs today, completed this week, overdue services, unpaid invoices). Technicians only see their own assigned jobs.",
      },
      {
        q: "What are the coloured status badges?",
        a: (
          <div className="space-y-1.5">
            {[
              { label: "Scheduled", cls: "bg-blue-100 text-blue-700" },
              { label: "In Progress", cls: "bg-amber-100 text-amber-700" },
              { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
              { label: "Awaiting Parts", cls: "bg-orange-100 text-orange-700" },
              { label: "Follow Up Required", cls: "bg-rose-100 text-rose-700" },
              { label: "Invoiced", cls: "bg-purple-100 text-purple-700" },
            ].map((s) => (
              <span key={s.label} className={cn("inline-flex text-xs font-semibold px-2 py-0.5 rounded-full mr-1.5", s.cls)}>
                {s.label}
              </span>
            ))}
          </div>
        ),
      },
      {
        q: "What are Overdue Services?",
        a: "Appliances (boilers etc.) that have passed their next service due date. These come from the appliance records on a property — a reminder to book a service for that customer.",
      },
    ],
  },
  {
    id: "customers",
    title: "Customers & Properties",
    icon: Users,
    color: "text-violet-600 bg-violet-50",
    items: [
      {
        q: "What is the difference between a Customer and a Property?",
        a: "A Customer is the person (with their contact details). A Property is the address where you carry out work. One customer can have multiple properties — e.g. a landlord with several rental houses.",
      },
      {
        q: "How do I add an appliance (boiler) to a property?",
        a: "Open the property, scroll down to the Appliances section, and click Add Appliance. You can set the make, model, serial number, and the Next Service Due date — this drives the overdue service reminders on the dashboard.",
      },
      {
        q: "Can I see a customer's full history?",
        a: "Yes — open a customer record to see all their properties, jobs, invoices, and service records in one place.",
      },
      {
        q: "What is the Customer Portal?",
        a: "A self-service portal your customers can log into to view their jobs, properties, and pay invoices online. You can invite a customer to the portal from their customer record.",
      },
    ],
  },
  {
    id: "jobs",
    title: "Jobs & Schedule",
    icon: Briefcase,
    color: "text-emerald-600 bg-emerald-50",
    items: [
      {
        q: "How do I book a job?",
        a: "Click '+ Book Job' on the dashboard or from the Schedule page. Select a customer, property, job type, date, time, and optionally assign a technician.",
      },
      {
        q: "What is the difference between an Enquiry and a Job?",
        a: "An Enquiry is an unconfirmed lead — someone who has called or emailed asking about work. You can convert it to a Job once confirmed. Enquiries show as a badge count in the sidebar.",
      },
      {
        q: "How do I use the Schedule calendar?",
        a: "The Schedule page shows all jobs in Day, Week, or Month view. Admins and office staff can drag and drop jobs to reschedule them. Click on a job to open it.",
      },
      {
        q: "How do I complete a job?",
        a: "Open the job and change the status to Completed. You can also add a service record (e.g. a boiler service certificate), upload photos, get a customer signature, and add notes before closing it.",
      },
      {
        q: "What are Follow-Ups?",
        a: "Jobs with the status Awaiting Parts or Follow Up Required appear in the Follow-Ups list. When parts arrive or the issue is resolved, return to the job, update the status, and book a follow-up visit.",
      },
      {
        q: "What service record forms are available?",
        a: "Boiler Service Record, Breakdown Report, Commissioning Record, Oil Tank Inspection, Oil Tank Risk Assessment, Combustion Analysis, Burner Setup, Fire Valve Test, Oil Line Vacuum Test, Job Completion Report, Heat Pump Service, Heat Pump Commissioning.",
      },
    ],
  },
  {
    id: "invoices",
    title: "Invoices & Quotes",
    icon: Receipt,
    color: "text-amber-600 bg-amber-50",
    items: [
      {
        q: "How do I create an invoice?",
        a: "Click '+ Invoice' on the dashboard, or open a job and click Create Invoice. Add your line items (labour, parts, VAT), then click Send to email it to the customer.",
      },
      {
        q: "How do I create a quote?",
        a: "Same as an invoice — click '+ Quote'. Quotes can be converted to invoices once the customer accepts.",
      },
      {
        q: "How does online payment work?",
        a: "Once you have connected Stripe (card payments) or GoCardless (direct debit) in Admin → Payment Providers, a Pay Now button appears on the invoice email and in the customer portal. When the customer pays, the invoice is automatically marked as paid.",
      },
      {
        q: "Where can I see all unpaid invoices?",
        a: "The Unpaid Invoices stat on the Dashboard links to a filtered list. You can also go to Invoices and filter by status.",
      },
      {
        q: "Can I add VAT to invoices?",
        a: "Yes — when adding line items you can set the VAT rate per item (0%, 5%, or 20%). The invoice will show the subtotal, VAT total, and grand total.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payment Setup",
    icon: CreditCard,
    color: "text-rose-600 bg-rose-50",
    roles: ["admin", "super_admin"],
    items: [
      {
        q: "How do I accept card payments from customers?",
        a: "Go to Admin → Payment Providers → Connect Stripe. This walks you through creating a Stripe account (or linking an existing one). Once connected, a Pay by Card button appears on all invoices you send.",
      },
      {
        q: "How do I set up Direct Debit (GoCardless)?",
        a: "Go to Admin → Payment Providers → Connect GoCardless. You will be taken through GoCardless's verification process. Once live, you can collect direct debit or instant bank pay from customers.",
      },
      {
        q: "Is there a transaction fee?",
        a: "Yes — Stripe and GoCardless both charge a small per-transaction fee set by them, not by TradeWorkDesk. Check stripe.com/gb/pricing and gocardless.com/pricing for current rates.",
      },
      {
        q: "Do I need both Stripe and GoCardless?",
        a: "No — you can use one or both. Stripe is best for one-off card payments. GoCardless is better for recurring customers or larger amounts where bank transfer is preferred.",
      },
    ],
  },
  {
    id: "team",
    title: "Team Management",
    icon: ShieldCheck,
    color: "text-sky-600 bg-sky-50",
    roles: ["admin", "super_admin"],
    items: [
      {
        q: "How do I add a new engineer or office staff member?",
        a: "Go to Admin → Invite Codes, generate a code, and share the sign-up link. They register using that link and are automatically added to your company with the role you chose.",
      },
      {
        q: "Can I reassign jobs from one technician to another?",
        a: "Yes — go to Admin → Reassign Jobs. Select the technician, choose a date range, and bulk-move their jobs to another technician. Useful if someone is off sick.",
      },
      {
        q: "How do I remove a team member?",
        a: "Go to Admin → Team. Find the user and deactivate their account. Their historical jobs and records are kept.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Settings",
    icon: UserCog,
    color: "text-slate-600 bg-slate-100",
    items: [
      {
        q: "Where do I change my password or name?",
        a: "Go to My Account at the bottom of the sidebar. You can update your name, email, and password there.",
      },
      {
        q: "How do I manage my subscription?",
        a: "Go to Billing in the sidebar. You can see your current plan, usage, and upgrade or change your plan.",
      },
      {
        q: "The app seems outdated or not showing new features. What should I do?",
        a: "Tap the Clear Cache button at the bottom of the sidebar. This clears the local cache and reloads the app with the latest version.",
      },
      {
        q: "Can I use the app on my phone?",
        a: "Yes — the app works on any mobile browser. You can also install it as an app by tapping Add to Home Screen in your browser menu for a full-screen experience.",
      },
    ],
  },
  {
    id: "technician",
    title: "Technician Guide",
    icon: Wrench,
    color: "text-teal-600 bg-teal-50",
    roles: ["technician"],
    items: [
      {
        q: "How do I see my jobs for today?",
        a: "Your Dashboard shows today's jobs and upcoming jobs assigned to you. Use the Schedule to see a week or month view.",
      },
      {
        q: "How do I mark a job as complete?",
        a: "Open the job and change the status to Completed. You can add notes, service records, photos, and a customer signature before closing it out.",
      },
      {
        q: "What should I do if I am waiting for parts?",
        a: "Set the job status to Awaiting Parts and add a note with what parts are needed and the expected delivery date. The job will appear in the Follow-Ups list so nothing is forgotten.",
      },
      {
        q: "How do I add a service record certificate?",
        a: "Open the job, scroll to the Forms section, and tap the appropriate form (e.g. Boiler Service Record). Fill in the details and save — it is stored against the job.",
      },
      {
        q: "Can I see a customer's appliance history?",
        a: "Yes — open the job and tap the property or customer link. You can see all previous jobs, service records, and appliance details for that address.",
      },
    ],
  },
];

function AccordionItem({ item }: { item: HelpItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        className="w-full flex items-start gap-3 py-3.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn("mt-0.5 shrink-0 w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="text-sm font-medium">{item.q}</span>
      </button>
      {open && (
        <div className="pl-7 pb-4 text-sm text-muted-foreground leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, defaultOpen }: { section: HelpSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const Icon = section.icon;
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", section.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 font-semibold text-sm">{section.title}</span>
        <span className="text-xs text-muted-foreground mr-2">{section.items.length} topics</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 border-t border-border/50">
          {section.items.map((item, i) => (
            <AccordionItem key={i} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function HelpPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "technician";
  const isTechnician = role === "technician";

  const visibleSections = sections.filter(
    (s) => !s.roles || s.roles.includes(role)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-primary" />
          User Guide
        </h1>
        <p className="text-muted-foreground mt-1">
          {isTechnician
            ? "Everything you need to know as a TradeWorkDesk technician."
            : "Everything you need to get up and running with TradeWorkDesk."}
        </p>
      </div>

      {!isTechnician && (
        <Card className="p-5 border-primary/20 bg-primary/5">
          <h2 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Quick Start Checklist
          </h2>
          <div className="space-y-2">
            {[
              { label: "Set up company profile", href: "/admin/company-settings" },
              { label: "Add your first customer", href: "/customers" },
              { label: "Book your first job", href: "/jobs" },
              { label: "Set up payment provider (optional)", href: "/admin/payment-providers" },
              { label: "Invite your team (optional)", href: "/admin/invite-codes" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {visibleSections.map((section, i) => (
          <SectionCard key={section.id} section={section} defaultOpen={i === 0} />
        ))}
      </div>

      <Card className="p-5 text-center border-slate-200 bg-slate-50">
        <p className="text-sm text-muted-foreground">
          Can't find what you're looking for?{" "}
          <a href="mailto:support@tradeworkdesk.co.uk" className="text-primary hover:underline font-medium">
            Contact support
          </a>
        </p>
      </Card>
    </div>
  );
}
