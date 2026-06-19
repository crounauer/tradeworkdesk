/**
 * Review Requests — settings and list of sent/pending review requests
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Plus, Send, Star } from "lucide-react";
import { format } from "date-fns";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface ReviewSettings {
  is_enabled: boolean;
  trigger_on: string;
  delay_hours: number;
  google_review_url: string | null;
  trustpilot_url: string | null;
  checkatrade_url: string | null;
  which_trusted_url: string | null;
  custom_review_url: string | null;
  custom_review_label: string | null;
  email_subject: string;
  email_body: string | null;
  sms_enabled: boolean;
  sms_body: string | null;
  max_per_customer_days: number;
}
interface ReviewRequest {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  channel: string;
  trigger_type: string;
  scheduled_for: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

interface CustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

const DEFAULT_SETTINGS: ReviewSettings = {
  is_enabled: false,
  trigger_on: "job_completed",
  delay_hours: 24,
  google_review_url: null,
  trustpilot_url: null,
  checkatrade_url: null,
  which_trusted_url: null,
  custom_review_url: null,
  custom_review_label: null,
  email_subject: "How did we do? Leave us a review",
  email_body: "Hi {{customer_name}},\n\nThank you for choosing {{company_name}}. We'd love to hear your feedback — it only takes a minute!\n\nClick below to leave a review:\n{{review_link}}\n\nMany thanks,\n{{company_name}}",
  sms_enabled: false,
  sms_body: null,
  max_per_customer_days: 90,
};

const STATUS_BADGE: Record<string, string> = {
  pending: "secondary",
  sent: "default",
  opened: "default",
  clicked: "default",
  failed: "destructive",
  suppressed: "secondary",
};

export default function ReviewRequests() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [settings, setSettings] = useState<ReviewSettings>(DEFAULT_SETTINGS);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("manual");
  const [customerSearch, setCustomerSearch] = useState("");
  const [manual, setManual] = useState({ customer_name: "", customer_email: "", customer_phone: "" });

  const { data: fetchedSettings, isLoading: settingsLoading } = useQuery<ReviewSettings>({
    queryKey: ["/api/review-requests/settings"],
    queryFn: () => apiFetch("/api/review-requests/settings"),
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery<ReviewRequest[]>({
    queryKey: ["/api/review-requests"],
    queryFn: () => apiFetch("/api/review-requests"),
  });

  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ["/api/customers", "review-request-picker"],
    queryFn: () => apiFetch("/api/customers"),
  });

  const filteredCustomers = customers.filter((customer) => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return true;

    const fullName = `${customer.first_name} ${customer.last_name}`.trim().toLowerCase();
    return fullName.includes(query)
      || (customer.email || "").toLowerCase().includes(query)
      || (customer.phone || "").toLowerCase().includes(query);
  });

  useEffect(() => {
    if (fetchedSettings && Object.keys(fetchedSettings).length > 0) {
      setSettings({ ...DEFAULT_SETTINGS, ...fetchedSettings });
    }
  }, [fetchedSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => apiFetch("/api/review-requests/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/review-requests/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendManualMutation = useMutation({
    mutationFn: async () => {
      const created = await apiFetch("/api/review-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manual, scheduled_for: new Date().toISOString() }),
      }) as ReviewRequest;

      await apiFetch(`/api/review-requests/${created.id}/send`, { method: "POST" });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/review-requests"] });
      setShowSendDialog(false);
      setSelectedCustomerId("manual");
      setCustomerSearch("");
      setManual({ customer_name: "", customer_email: "", customer_phone: "" });
      toast({ title: "Review request sent" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendNowMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/review-requests/${id}/send`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/review-requests"] });
      toast({ title: "Sent" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (settingsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          <h1 className="text-2xl font-bold">Review Requests</h1>
          <Badge variant={settings.is_enabled ? "default" : "secondary"}>
            {settings.is_enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setShowSendDialog(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Send Manually
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="platforms">Review Platforms</TabsTrigger>
          <TabsTrigger value="template">Email Template</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── Settings ── */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Automation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable automated review requests</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Send requests automatically after jobs or invoices</p>
                </div>
                <Switch checked={settings.is_enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))} />
              </div>
              <Separator />
              <div className="space-y-1">
                <Label className="text-xs">Send automatically when…</Label>
                <Select value={settings.trigger_on} onValueChange={(v) => setSettings((s) => ({ ...s, trigger_on: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_completed">Job is marked completed</SelectItem>
                    <SelectItem value="invoice_paid">Invoice is paid</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delay after trigger (hours)</Label>
                <Select value={String(settings.delay_hours)} onValueChange={(v) => setSettings((s) => ({ ...s, delay_hours: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Don't re-request same customer within (days)</Label>
                <Input type="number" min={7} value={settings.max_per_customer_days}
                  onChange={(e) => setSettings((s) => ({ ...s, max_per_customer_days: parseInt(e.target.value) || 90 }))} />
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </TabsContent>

        {/* ── Review platforms ── */}
        <TabsContent value="platforms" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Review Platform Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Add links to your profiles. The first one configured will be used as the primary review link.</p>
              {[
                { key: "google_review_url", label: "Google Review Link" },
                { key: "trustpilot_url", label: "Trustpilot URL" },
                { key: "checkatrade_url", label: "Checkatrade URL" },
                { key: "which_trusted_url", label: "Which? Trusted Trader URL" },
                { key: "custom_review_url", label: "Custom Review URL" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input value={(settings as unknown as Record<string, string | null>)[key] ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value || null }))}
                    placeholder="https://..." />
                </div>
              ))}
            </CardContent>
          </Card>
          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Platforms
          </Button>
        </TabsContent>

        {/* ── Email template ── */}
        <TabsContent value="template" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Email Template</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Available variables: <code>{"{{customer_name}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{review_link}}"}</code>
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input value={settings.email_subject}
                  onChange={(e) => setSettings((s) => ({ ...s, email_subject: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Textarea value={settings.email_body ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, email_body: e.target.value || null }))}
                  rows={8} className="font-mono text-xs" />
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Template
          </Button>
        </TabsContent>

        {/* ── History ── */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {requestsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : requests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No review requests sent yet.</CardContent></Card>
          ) : (
            requests.map((rr) => (
              <Card key={rr.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{rr.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{rr.customer_email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Scheduled {format(new Date(rr.scheduled_for), "d MMM yyyy HH:mm")}
                      {rr.sent_at && ` · Sent ${format(new Date(rr.sent_at), "d MMM HH:mm")}`}
                      {rr.clicked_at && " · Clicked ✓"}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[rr.status] as "default" | "secondary" | "destructive" | "outline"}>
                    {rr.status}
                  </Badge>
                  {rr.status === "pending" && (
                    <Button size="sm" variant="outline"
                      onClick={() => sendNowMutation.mutate(rr.id)}
                      disabled={sendNowMutation.isPending}>
                      <Send className="w-3 h-3 mr-1" /> Send Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Manual send dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Review Request</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Select Customer</Label>
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search by name, email or phone"
              />
              <Select
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(value);
                  if (value === "manual") {
                    return;
                  }

                  const customer = customers.find((item) => item.id === value);
                  if (!customer) {
                    return;
                  }

                  setManual({
                    customer_name: `${customer.first_name} ${customer.last_name}`.trim(),
                    customer_email: customer.email || "",
                    customer_phone: customer.phone || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an existing customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  {filteredCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {`${customer.first_name} ${customer.last_name}`.trim()}
                      {customer.email ? ` · ${customer.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input value={manual.customer_name} onChange={(e) => setManual((m) => ({ ...m, customer_name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Email Address</Label>
              <Input type="email" value={manual.customer_email} onChange={(e) => setManual((m) => ({ ...m, customer_email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone (optional)</Label>
              <Input value={manual.customer_phone} onChange={(e) => setManual((m) => ({ ...m, customer_phone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => sendManualMutation.mutate()}
              disabled={!manual.customer_name || !manual.customer_email || sendManualMutation.isPending}>
              {sendManualMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
