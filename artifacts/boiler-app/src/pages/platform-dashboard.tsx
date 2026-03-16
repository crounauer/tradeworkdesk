import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, CreditCard, Clock, DollarSign, TrendingUp, Mail, Loader2, CheckCircle2, Globe } from "lucide-react";
import { Link } from "wouter";

const EMAIL_TEMPLATES = [
  { value: "welcome", label: "Welcome (new account)" },
  { value: "invoice", label: "Invoice / payment received" },
  { value: "trial_expiry", label: "Trial expiry reminder" },
  { value: "renewal_reminder", label: "Renewal reminder" },
  { value: "payment_failed", label: "Payment failed" },
];

const INDEXNOW_URLS = [
  "https://boilertech.replit.app/",
  "https://boilertech.replit.app/features",
  "https://boilertech.replit.app/pricing",
  "https://boilertech.replit.app/about",
  "https://boilertech.replit.app/contact",
  "https://boilertech.replit.app/blog",
  "https://boilertech.replit.app/gas-engineer-software",
  "https://boilertech.replit.app/boiler-service-management-software",
  "https://boilertech.replit.app/job-management-software-heating-engineers",
  "https://boilertech.replit.app/blog/how-to-go-paperless-as-a-gas-engineer",
  "https://boilertech.replit.app/blog/gas-safe-record-keeping-guide",
  "https://boilertech.replit.app/blog/best-software-for-heating-engineers",
  "https://boilertech.replit.app/blog/managing-boiler-service-contracts",
  "https://boilertech.replit.app/blog/heat-pump-service-software",
];

export default function PlatformDashboard() {
  const { toast } = useToast();
  const [emailTemplate, setEmailTemplate] = useState("welcome");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [indexNowSubmitted, setIndexNowSubmitted] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const { data: mrrData } = useQuery({
    queryKey: ["platform-mrr"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats/mrr");
      if (!res.ok) return { mrr: 0 };
      return res.json();
    },
  });

  const { data: signupData } = useQuery({
    queryKey: ["platform-signups"],
    queryFn: async () => {
      const res = await fetch("/api/platform/stats/signups");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: recentAudit } = useQuery({
    queryKey: ["platform-audit-recent"],
    queryFn: async () => {
      const res = await fetch("/api/platform/audit-log?limit=10");
      if (!res.ok) throw new Error("Failed to load audit log");
      return res.json();
    },
  });

  const indexNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/indexnow/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: INDEXNOW_URLS }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIndexNowSubmitted(true);
      toast({ title: "IndexNow submitted", description: `${data.submitted} URLs submitted for indexing` });
      setTimeout(() => setIndexNowSubmitted(false), 5000);
    },
    onError: (e) => toast({ title: "IndexNow failed", description: e.message, variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!emailRecipient) throw new Error("Recipient email is required");
      const res = await fetch("/api/platform/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: emailTemplate, to: emailRecipient }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({ title: "Test email sent", description: `Sent "${emailTemplate}" template to ${emailRecipient}` });
      setTimeout(() => setEmailSent(false), 3000);
    },
    onError: (e) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const maxSignups = Math.max(1, ...(signupData || []).map((d: { count: number }) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of all tenants and platform health</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_tenants || 0}</p>
                <p className="text-sm text-muted-foreground">Total Companies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.active_tenants || 0}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.trial_tenants || 0}</p>
                <p className="text-sm text-muted-foreground">On Trial</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mrrData?.mrr != null ? `$${Number(mrrData.mrr).toLocaleString()}` : "$0"}</p>
                <p className="text-sm text-muted-foreground">MRR</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Sign-ups (Last 12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!signupData || signupData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {signupData.map((d: { month: string; count: number }) => (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{d.count > 0 ? d.count : ""}</span>
                    <div
                      className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(2, (d.count / maxSignups) * 120)}px` }}
                    />
                    <span className="text-[10px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap">
                      {d.month.substring(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/platform/tenants" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Manage Companies</p>
              <p className="text-xs text-muted-foreground">View, edit, and manage all tenant companies</p>
            </Link>
            <Link href="/platform/plans" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pricing Plans ({stats?.plans?.length || 0})</p>
              <p className="text-xs text-muted-foreground">Configure subscription tiers and features</p>
            </Link>
            <Link href="/platform/announcements" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
              <p className="font-medium text-sm">Announcements</p>
              <p className="text-xs text-muted-foreground">Send platform-wide notifications</p>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentAudit || recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentAudit.slice(0, 8).map((entry: { id: string; event_type: string; actor_email: string; created_at: string; detail?: Record<string, unknown> }) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.event_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor_email} &middot; {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Send Test Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Template</Label>
              <select
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Recipient email</Label>
              <Input
                type="email"
                placeholder="test@example.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending || !emailRecipient || emailSent}
            >
              {sendEmailMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
              ) : emailSent ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />Sent!</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Send Test Email</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sends a sample email using the selected template. Uses placeholder data.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            IndexNow — Search Engine Indexing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Submit all marketing and blog URLs to search engines (Google, Bing, Yandex) for fast indexing via the IndexNow protocol. This notifies search engines that your content has been updated.
          </p>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => indexNowMutation.mutate()}
              disabled={indexNowMutation.isPending || indexNowSubmitted}
            >
              {indexNowMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : indexNowSubmitted ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />Submitted!</>
              ) : (
                <><Globe className="w-4 h-4 mr-2" />Submit {INDEXNOW_URLS.length} URLs</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">{INDEXNOW_URLS.length} pages will be submitted</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
