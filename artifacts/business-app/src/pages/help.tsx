import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import {
  ChevronDown, ChevronRight, BookOpen, Rocket, Users,
  Briefcase, CalendarDays, Receipt, CreditCard, ShieldCheck,
  UserCog, HelpCircle, CheckCircle2, Wrench, Settings2, Share2,
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
  {
    id: "social-media-api",
    title: "Social Media API Setup",
    icon: Share2,
    color: "text-pink-600 bg-pink-50",
    roles: ["admin", "super_admin"],
    items: [
      {
        q: "Overview — how social media accounts connect",
        a: (
          <div className="space-y-2">
            <p>TradeWorkDesk posts to social media using official platform APIs. For each account you want to connect, you need to create a developer application on that platform and generate API credentials (keys/tokens). These are then entered once in <strong>Admin → Social Media → Connect Account</strong>.</p>
            <p>The four supported platforms are <strong>X (Twitter)</strong>, <strong>Facebook</strong>, <strong>Instagram</strong>, and <strong>Google Business Profile</strong>. Follow the guide for each platform below.</p>
          </div>
        ),
      },
      {
        q: "X (Twitter) — setting up API access",
        a: (
          <div className="space-y-3">
            <p className="font-medium text-foreground">You will need: App Key, App Secret, Access Token, Access Secret</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to the <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline">X Developer Portal</a> and sign in with your X account.</li>
              <li>Click <strong>+ Create Project</strong>. Give it a name (e.g. "TradeWorkDesk"), choose a use case (e.g. "Making a bot"), and add a description.</li>
              <li>Inside the project, click <strong>+ Add App</strong>. Give the app a name and click <strong>Next</strong>. <em>Save the keys shown on screen — you will not see them again.</em></li>
              <li>In the app dashboard, click <strong>App Settings</strong>. Under <em>User authentication settings</em>, click <strong>Set up</strong>.</li>
              <li>Enable <strong>OAuth 1.0a</strong>. Set <em>App permissions</em> to <strong>Read and Write</strong>. Enter any valid callback URL (e.g. <code>https://example.com</code>) and website URL, then save.</li>
              <li>Go to <strong>Keys and Tokens</strong> tab. Under <em>Authentication Tokens</em>, click <strong>Generate</strong> next to <em>Access Token and Secret</em>. Copy both values.</li>
              <li>You now have four values: <strong>API Key</strong> (= App Key), <strong>API Secret</strong> (= App Secret), <strong>Access Token</strong>, and <strong>Access Token Secret</strong>.</li>
              <li>In TradeWorkDesk go to <strong>Admin → Social Media</strong>, click <strong>Connect Account</strong>, select <em>X (Twitter)</em>, and paste in all four values.</li>
            </ol>
            <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <strong>Note:</strong> Free X developer accounts only allow posting. If your app was created before 2023 you may need to apply for <em>Basic</em> tier access at developer.x.com/en/portal/products.
            </p>
          </div>
        ),
      },
      {
        q: "Facebook — setting up API access",
        a: (
          <div className="space-y-3">
            <p className="font-medium text-foreground">You will need: Page Access Token, Facebook Page ID</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.facebook.com</a> and log in with the Facebook account that manages your business Page.</li>
              <li>Click <strong>My Apps → Create App</strong>. Choose <em>Business</em> as the type. Enter an app name and contact email, then click <strong>Create App</strong>.</li>
              <li>In the app dashboard, find <strong>Facebook Login for Business</strong> in the product list and click <strong>Set up</strong>.</li>
              <li>Also add the <strong>Pages API</strong> product (search for it in the product catalogue).</li>
              <li>In the left sidebar go to <strong>Tools → Graph API Explorer</strong> (<a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary underline">direct link</a>).</li>
              <li>Select your app in the top-right dropdown. Click <strong>Generate Access Token</strong>. In the permissions screen, tick <code>pages_show_list</code>, <code>pages_read_engagement</code>, and <code>pages_manage_posts</code>, then allow.</li>
              <li>With the user token in the input box, type <code>me/accounts</code> in the path field and click <strong>Submit</strong>. This returns a list of your Pages.</li>
              <li>From the response, copy the <strong>access_token</strong> for your Page (this is the Page Access Token) and the <strong>id</strong> (this is the Page ID).</li>
              <li><strong>Convert to a long-lived token</strong> (recommended): Use the <a href="https://developers.facebook.com/tools/accesstoken" target="_blank" rel="noopener noreferrer" className="text-primary underline">Access Token Debugger</a> → <em>Extend Access Token</em> to get a 60-day token. For a never-expiring token, exchange it for a permanent Page token via the API.</li>
              <li>In TradeWorkDesk go to <strong>Admin → Social Media</strong>, click <strong>Connect Account</strong>, select <em>Facebook</em>, enter the Page Access Token, Page ID, and your page's display name.</li>
            </ol>
            <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <strong>Note:</strong> Your app must be in <em>Live</em> mode (not Development) to post to pages you do not own. Switch mode in App Settings → Basic → App Mode.
            </p>
          </div>
        ),
      },
      {
        q: "Instagram — setting up API access",
        a: (
          <div className="space-y-3">
            <p className="font-medium text-foreground">You will need: Page Access Token, Instagram Business Account ID — and a Facebook Page linked to your Instagram account</p>
            <p className="text-xs bg-blue-50 border border-blue-200 rounded p-2">Instagram Business posting uses the same Meta/Facebook API. You must have an <strong>Instagram Business or Creator account</strong> linked to a Facebook Page before starting.</p>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Link Instagram to a Facebook Page</strong> (if not done already): In Instagram mobile app go to <em>Settings → Account → Linked Accounts</em> and connect your Facebook Page. Alternatively do this in <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Business Suite</a>.</li>
              <li>Follow steps 1–8 of the Facebook guide above to create a Meta developer app and get a Page Access Token. Also request the <code>instagram_basic</code> and <code>instagram_content_publish</code> permissions in Graph API Explorer.</li>
              <li>In Graph API Explorer, with the Page Access Token, call: <code>{"{page-id}"}?fields=instagram_business_account</code>. The response will contain the <strong>Instagram Business Account ID</strong>.</li>
              <li>In TradeWorkDesk go to <strong>Admin → Social Media</strong>, click <strong>Connect Account</strong>, select <em>Instagram</em>. Enter the <strong>Page Access Token</strong>, <strong>Page ID</strong>, and the <strong>Instagram Business Account ID</strong> you just retrieved.</li>
            </ol>
            <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <strong>Note:</strong> Instagram posts via this API <strong>require an image</strong>. Text-only posts are not supported by the Instagram Content Publishing API.
            </p>
          </div>
        ),
      },
      {
        q: "Google Business Profile — setting up API access",
        a: (
          <div className="space-y-3">
            <p className="font-medium text-foreground">You will need: OAuth Client ID, OAuth Client Secret, OAuth Refresh Token, Account resource name, Location ID</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a> and sign in with the Google account that manages your Business Profile.</li>
              <li>Create a new project (or select an existing one). Click <strong>Select a project → New Project</strong>, give it a name, and click <strong>Create</strong>.</li>
              <li>Enable the required APIs: in the left menu go to <strong>APIs & Services → Library</strong>. Search for and enable both <strong>"My Business Business Information API"</strong> and <strong>"My Business Notifications API"</strong>. Also enable <strong>"My Business Lodging API"</strong> if prompted.</li>
              <li>Go to <strong>APIs & Services → OAuth consent screen</strong>. Choose <em>External</em>, fill in the app name and your email, and add the scope <code>https://www.googleapis.com/auth/business.manage</code>. Add your own Google account as a test user and save.</li>
              <li>Go to <strong>APIs & Services → Credentials</strong>. Click <strong>+ Create Credentials → OAuth client ID</strong>. Choose <em>Web application</em> as the type. Under <em>Authorised redirect URIs</em> add <code>https://developers.google.com/oauthplayground</code>. Click <strong>Create</strong> and copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.</li>
              <li>Open the <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-primary underline">OAuth 2.0 Playground</a>. Click the gear icon (⚙) top-right, tick <em>Use your own OAuth credentials</em>, paste your Client ID and Secret, then close.</li>
              <li>In Step 1, paste <code>https://www.googleapis.com/auth/business.manage</code> into the scope box and click <strong>Authorise APIs</strong>. Sign in and allow access.</li>
              <li>In Step 2, click <strong>Exchange authorisation code for tokens</strong>. Copy the <strong>Refresh Token</strong> from the response.</li>
              <li><strong>Find your Account Name and Location ID</strong>: Call <code>GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts</code> using the Playground (Step 3). The response lists your accounts — copy the <strong>name</strong> field (format: <code>accounts/123456</code>). Then call <code>GET https://mybusinessbusinessinformation.googleapis.com/v1/{"{account-name}"}/locations</code> to get your locations and copy the <strong>name</strong> field (format: <code>locations/789012</code>).</li>
              <li>In TradeWorkDesk go to <strong>Admin → Social Media</strong>, click <strong>Connect Account</strong>, select <em>Google Business</em>. Enter the Client ID, Client Secret, Refresh Token, Account Name (e.g. <code>accounts/123456</code>), and Location ID (e.g. <code>locations/789012</code>).</li>
            </ol>
            <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <strong>Note:</strong> The Google OAuth refresh token does not expire as long as the app is used at least once every 6 months. Keep the Client Secret secure — it is stored encrypted in TradeWorkDesk.
            </p>
          </div>
        ),
      },
      {
        q: "How do I find my Facebook Page ID?",
        a: (
          <div className="space-y-2">
            <p>There are two easy ways:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Go to your Facebook Page, click <strong>About</strong> in the left menu, and scroll to the bottom — the Page ID is listed there.</li>
              <li>Go to <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary underline">Graph API Explorer</a>, call <code>me/accounts</code> with a user token, and copy the <strong>id</strong> from your Page in the response.</li>
            </ol>
          </div>
        ),
      },
      {
        q: "What permissions does my Meta app need?",
        a: (
          <ul className="list-disc list-inside space-y-1.5">
            <li><code>pages_show_list</code> — see which Pages you manage</li>
            <li><code>pages_read_engagement</code> — read Page content</li>
            <li><code>pages_manage_posts</code> — create and publish posts on a Page</li>
            <li><code>instagram_basic</code> — read Instagram account info (Instagram only)</li>
            <li><code>instagram_content_publish</code> — publish posts to Instagram (Instagram only)</li>
          </ul>
        ),
      },
      {
        q: "My token expired — how do I refresh it?",
        a: (
          <div className="space-y-2">
            <p><strong>X (Twitter):</strong> Access tokens do not expire unless you revoke them. If posting fails, regenerate them in the <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline">X Developer Portal</a> under Keys and Tokens.</p>
            <p><strong>Facebook / Instagram:</strong> Page Access Tokens can be long-lived (60 days) or permanent. Use the <a href="https://developers.facebook.com/tools/accesstoken" target="_blank" rel="noopener noreferrer" className="text-primary underline">Access Token Debugger</a> to check expiry and extend. To get a non-expiring Page token, exchange your long-lived user token for a Page token via the Graph API.</p>
            <p><strong>Google Business:</strong> Refresh tokens do not expire unless revoked or unused for 6 months. If it stops working, return to the <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-primary underline">OAuth Playground</a> and generate a new one. Update the credential in Admin → Social Media → edit the account.</p>
          </div>
        ),
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
