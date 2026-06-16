/**
 * Maintenance Plans — manage plan tiers, customer subscriptions, and service reminders
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
import {
  Save, Loader2, Plus, Trash2, ShieldCheck, Bell, RefreshCw, Send,
} from "lucide-react";
import { format, parseISO } from "date-fns";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface PlanTier {
  id: string;
  name: string;
  description: string | null;
  price_per_year: number;
  includes_parts: boolean;
  max_callouts: number | null;
  services_included: number;
  colour: string;
  is_active: boolean;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  renewal_date: string;
  payment_method: string;
  tier: { name: string; colour: string; price_per_year: number } | null;
  customer: { first_name: string | null; last_name: string | null; email: string } | null;
  property: { address_line1: string; postcode: string } | null;
}

interface Reminder {
  id: string;
  status: string;
  reminder_type: string;
  due_date: string;
  channel: string;
  customer: { first_name: string | null; last_name: string | null; email: string; phone: string | null } | null;
  property: { address_line1: string; postcode: string } | null;
  appliance: { manufacturer: string; model: string; fuel_type: string } | null;
}

interface ReminderSettings {
  is_enabled: boolean;
  advance_days: number;
  follow_up_days: number;
  email_enabled: boolean;
  sms_enabled: boolean;
  auto_create_job: boolean;
  email_subject: string;
  email_body: string | null;
  sms_body: string | null;
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  is_enabled: false,
  advance_days: 30,
  follow_up_days: 7,
  email_enabled: true,
  sms_enabled: false,
  auto_create_job: false,
  email_subject: "Your annual boiler service is due",
  email_body: "Hi {{customer_name}},\n\nYour annual boiler service is due on {{due_date}}.\n\nPlease contact us to book your appointment.\n\nRegards,\n{{company_name}}",
  sms_body: null,
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "secondary",
  cancelled: "destructive",
  suspended: "secondary",
  pending: "secondary",
  sent: "default",
  opened: "default",
  completed: "default",
  dismissed: "secondary",
  failed: "destructive",
};

export default function MaintenancePlans() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Partial<PlanTier> | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<PlanTier[]>({
    queryKey: ["/api/maintenance/tiers"],
    queryFn: () => apiFetch("/api/maintenance/tiers"),
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/maintenance/subscriptions"],
    queryFn: () => apiFetch("/api/maintenance/subscriptions"),
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/maintenance/reminders"],
    queryFn: () => apiFetch("/api/maintenance/reminders?status=pending&limit=100"),
  });

  const { data: fetchedReminderSettings } = useQuery<ReminderSettings>({
    queryKey: ["/api/maintenance/reminder-settings"],
    queryFn: () => apiFetch("/api/maintenance/reminder-settings"),
  });

  useEffect(() => {
    if (fetchedReminderSettings && Object.keys(fetchedReminderSettings).length > 0) {
      setReminderSettings({ ...DEFAULT_REMINDER_SETTINGS, ...fetchedReminderSettings });
    }
  }, [fetchedReminderSettings]);

  const saveTierMutation = useMutation({
    mutationFn: (tier: Partial<PlanTier>) => {
      if (tier.id) {
        return apiFetch(`/api/maintenance/tiers/${tier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tier),
        });
      }
      return apiFetch("/api/maintenance/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tier),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance/tiers"] });
      setTierDialogOpen(false);
      toast({ title: "Plan tier saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/maintenance/tiers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance/tiers"] });
      toast({ title: "Tier deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveReminderSettingsMutation = useMutation({
    mutationFn: () => apiFetch("/api/maintenance/reminder-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reminderSettings),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance/reminder-settings"] });
      toast({ title: "Reminder settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateRemindersMutation = useMutation({
    mutationFn: () => apiFetch("/api/maintenance/reminders/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advance_days: reminderSettings.advance_days }),
    }),
    onSuccess: (data: { created: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance/reminders"] });
      toast({ title: `Generated ${data.created} new reminder${data.created !== 1 ? "s" : ""}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendReminderMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/maintenance/reminders/${id}/send`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance/reminders"] });
      toast({ title: "Reminder sent" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelSubMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/maintenance/subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/maintenance/subscriptions"] });
      toast({ title: "Subscription cancelled" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeSubCount = subscriptions.filter((s) => s.status === "active").length;
  const pendingReminderCount = reminders.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-600" />
        <h1 className="text-2xl font-bold">Maintenance Plans</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{tiers.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Plan Tiers</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{activeSubCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Subscriptions</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{pendingReminderCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending Reminders</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="tiers">
        <TabsList>
          <TabsTrigger value="tiers">Plan Tiers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="reminders">Service Reminders</TabsTrigger>
          <TabsTrigger value="reminder-settings">Reminder Settings</TabsTrigger>
        </TabsList>

        {/* ── Plan tiers ── */}
        <TabsContent value="tiers" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingTier({}); setTierDialogOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Plan Tier
            </Button>
          </div>
          {tiersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tiers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No plan tiers yet.</CardContent></Card>
          ) : (
            tiers.map((tier) => (
              <Card key={tier.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: tier.colour }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{tier.name}</p>
                      {!tier.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      £{Number(tier.price_per_year).toFixed(2)}/yr ·{" "}
                      {tier.services_included} service{tier.services_included !== 1 ? "s" : ""} ·{" "}
                      {tier.max_callouts == null ? "unlimited" : tier.max_callouts} callouts ·{" "}
                      {tier.includes_parts ? "parts included" : "parts extra"}
                    </p>
                    {tier.description && <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditingTier(tier); setTierDialogOpen(true); }}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive"
                    onClick={() => { if (confirm(`Delete "${tier.name}"?`)) deleteTierMutation.mutate(tier.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Subscriptions ── */}
        <TabsContent value="subscriptions" className="space-y-3 mt-4">
          {subsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : subscriptions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No subscriptions yet.</CardContent></Card>
          ) : (
            subscriptions.map((sub) => (
              <Card key={sub.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {sub.customer ? `${sub.customer.first_name ?? ""} ${sub.customer.last_name ?? ""}`.trim() : "Unknown"}
                      </p>
                      {sub.tier && (
                        <Badge variant="outline" style={{ borderColor: sub.tier.colour, color: sub.tier.colour }}>
                          {sub.tier.name}
                        </Badge>
                      )}
                      <Badge variant={STATUS_BADGE[sub.status] ?? "secondary"}>{sub.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sub.property ? `${sub.property.address_line1}, ${sub.property.postcode}` : "No property"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Renewal: {format(parseISO(sub.renewal_date), "d MMM yyyy")} · {sub.payment_method}
                    </p>
                  </div>
                  {sub.status === "active" && (
                    <Button size="sm" variant="outline" className="text-destructive text-xs flex-shrink-0"
                      onClick={() => { if (confirm("Cancel this subscription?")) cancelSubMutation.mutate(sub.id); }}>
                      Cancel
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Service reminders ── */}
        <TabsContent value="reminders" className="space-y-3 mt-4">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline"
              onClick={() => generateRemindersMutation.mutate()}
              disabled={generateRemindersMutation.isPending}>
              {generateRemindersMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Generate from Appliances
            </Button>
          </div>
          {remindersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : reminders.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              No pending reminders. Click "Generate from Appliances" to create them automatically.
            </CardContent></Card>
          ) : (
            reminders.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {r.customer ? `${r.customer.first_name ?? ""} ${r.customer.last_name ?? ""}`.trim() : "Unknown"}
                      </p>
                      <Badge variant={STATUS_BADGE[r.status] ?? "secondary"}>{r.status}</Badge>
                      <Badge variant="outline">{r.reminder_type.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {format(parseISO(r.due_date), "d MMM yyyy")}
                      {r.property && ` · ${r.property.address_line1}`}
                    </p>
                    {r.appliance && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.appliance.manufacturer} {r.appliance.model} ({r.appliance.fuel_type})
                      </p>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline"
                      onClick={() => sendReminderMutation.mutate(r.id)}
                      disabled={sendReminderMutation.isPending}>
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Reminder settings ── */}
        <TabsContent value="reminder-settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Automation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable service reminders</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically send reminders when services are due</p>
                </div>
                <Switch checked={reminderSettings.is_enabled}
                  onCheckedChange={(v) => setReminderSettings((s) => ({ ...s, is_enabled: v }))} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Send reminder X days before due</Label>
                  <Input type="number" min={1} value={reminderSettings.advance_days}
                    onChange={(e) => setReminderSettings((s) => ({ ...s, advance_days: parseInt(e.target.value) || 30 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Follow-up if no response (days)</Label>
                  <Input type="number" min={1} value={reminderSettings.follow_up_days}
                    onChange={(e) => setReminderSettings((s) => ({ ...s, follow_up_days: parseInt(e.target.value) || 7 }))} />
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="email-enabled" checked={reminderSettings.email_enabled}
                    onCheckedChange={(v) => setReminderSettings((s) => ({ ...s, email_enabled: v }))} />
                  <Label htmlFor="email-enabled" className="text-sm">Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="sms-enabled" checked={reminderSettings.sms_enabled}
                    onCheckedChange={(v) => setReminderSettings((s) => ({ ...s, sms_enabled: v }))} />
                  <Label htmlFor="sms-enabled" className="text-sm">SMS</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="auto-job" checked={reminderSettings.auto_create_job}
                    onCheckedChange={(v) => setReminderSettings((s) => ({ ...s, auto_create_job: v }))} />
                  <Label htmlFor="auto-job" className="text-sm">Auto-create job</Label>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Email Template</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Variables: <code>{"{{customer_name}}"}</code>, <code>{"{{due_date}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{booking_link}}"}</code>
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input value={reminderSettings.email_subject}
                  onChange={(e) => setReminderSettings((s) => ({ ...s, email_subject: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Textarea value={reminderSettings.email_body ?? ""}
                  onChange={(e) => setReminderSettings((s) => ({ ...s, email_body: e.target.value || null }))}
                  rows={6} className="font-mono text-xs" />
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => saveReminderSettingsMutation.mutate()} disabled={saveReminderSettingsMutation.isPending}>
            {saveReminderSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </TabsContent>
      </Tabs>

      {/* Tier dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTier?.id ? "Edit Plan Tier" : "New Plan Tier"}</DialogTitle>
          </DialogHeader>
          {editingTier && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editingTier.name ?? ""}
                  onChange={(e) => setEditingTier((t) => ({ ...t!, name: e.target.value }))} autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={editingTier.description ?? ""}
                  onChange={(e) => setEditingTier((t) => ({ ...t!, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Price per year (£)</Label>
                  <Input type="number" min={0} step={0.01}
                    value={editingTier.price_per_year ?? ""}
                    onChange={(e) => setEditingTier((t) => ({ ...t!, price_per_year: parseFloat(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Services included</Label>
                  <Input type="number" min={1}
                    value={editingTier.services_included ?? 1}
                    onChange={(e) => setEditingTier((t) => ({ ...t!, services_included: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Max callouts (blank = unlimited)</Label>
                  <Input type="number" min={0}
                    value={editingTier.max_callouts ?? ""}
                    onChange={(e) => setEditingTier((t) => ({ ...t!, max_callouts: e.target.value ? parseInt(e.target.value) : null }))} />
                </div>
                <div className="space-y-1">
                  <Label>Badge colour</Label>
                  <Input type="color"
                    value={editingTier.colour ?? "#6366f1"}
                    onChange={(e) => setEditingTier((t) => ({ ...t!, colour: e.target.value }))}
                    className="h-9 p-1 cursor-pointer" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="includes-parts" checked={editingTier.includes_parts ?? false}
                  onCheckedChange={(v) => setEditingTier((t) => ({ ...t!, includes_parts: v }))} />
                <Label htmlFor="includes-parts">Parts included</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="tier-active" checked={editingTier.is_active !== false}
                  onCheckedChange={(v) => setEditingTier((t) => ({ ...t!, is_active: v }))} />
                <Label htmlFor="tier-active">Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => saveTierMutation.mutate(editingTier!)}
              disabled={!editingTier?.name || saveTierMutation.isPending}>
              {saveTierMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
