import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, X, Save, Trash2, Package, Settings, Check } from "lucide-react";

interface Addon {
  id: string;
  name: string;
  description: string | null;
  feature_keys: string[];
  monthly_price: number;
  annual_price: number;
  stripe_price_id: string | null;
  stripe_price_id_annual: string | null;
  is_active: boolean;
  sort_order: number;
}

interface AddonFormState {
  name: string;
  description: string;
  feature_keys: string;
  monthly_price: number | string;
  annual_price: number | string;
  stripe_price_id: string;
  stripe_price_id_annual: string;
  is_active: boolean;
  is_per_seat: boolean;
  sort_order: number | string;
}

const AVAILABLE_FEATURE_KEYS = [
  { key: "job_management", label: "Job Management", description: "Full jobs page access" },
  { key: "geo_mapping", label: "Geo Mapping", description: "Map views on jobs, properties & customers" },
  { key: "advanced_analytics", label: "Advanced Analytics", description: "Advanced reporting features" },
  { key: "report_export", label: "Report Export", description: "Export reports to PDF/CSV" },
  { key: "google_calendar", label: "Google Calendar Sync", description: "Sync jobs to Google Calendar" },
  { key: "accounting_integration", label: "Accounting Integration", description: "Connect to Xero, QuickBooks, or Sage" },
  { key: "invoice_export", label: "Invoice Export", description: "Export invoices to PDF/CSV" },
  { key: "gas_forms", label: "Gas Forms", description: "Gas service record & commissioning forms" },
  { key: "oil_forms", label: "Oil Forms", description: "Oil service, tank inspection & risk assessment forms" },
  { key: "heat_pump_forms", label: "Heat Pump Forms", description: "Heat pump service & commissioning forms" },
  { key: "time_attended", label: "Time Attended", description: "Track arrival/departure times per job visit" },
  { key: "photos", label: "Photos", description: "Attach photos to jobs" },
  { key: "parts_used", label: "Parts Used", description: "Record parts and materials used on jobs" },
  { key: "customer_email_forms", label: "Customer Email Forms", description: "Email completed forms to customers" },
  { key: "customer_email_photos", label: "Customer Email Photos", description: "Email job photos to customers" },
  { key: "additional_users", label: "Additional Users", description: "Allow more users on the account" },
  { key: "jobs_per_month", label: "Jobs Per Month", description: "Increase monthly job allowance" },
];

const EMPTY_FORM: AddonFormState = {
  name: "",
  description: "",
  feature_keys: "",
  monthly_price: "",
  annual_price: "",
  stripe_price_id: "",
  stripe_price_id_annual: "",
  is_active: true,
  is_per_seat: false,
  sort_order: "",
};

export default function PlatformAddons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(() => {
    try { return sessionStorage.getItem("addon-editingId") || null; } catch { return null; }
  });
  const [showNew, setShowNew] = useState(() => {
    try { return sessionStorage.getItem("addon-showNew") === "true"; } catch { return false; }
  });
  const [form, setForm] = useState<AddonFormState>(() => {
    try {
      const saved = sessionStorage.getItem("addon-form");
      return saved ? JSON.parse(saved) : EMPTY_FORM;
    } catch { return EMPTY_FORM; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("addon-form", JSON.stringify(form));
      sessionStorage.setItem("addon-showNew", String(showNew));
      sessionStorage.setItem("addon-editingId", editingId || "");
    } catch {}
  }, [form, showNew, editingId]);

  const { data: addons, isLoading } = useQuery({
    queryKey: ["platform-addons"],
    queryFn: async () => {
      const res = await fetch("/api/platform/addons");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Addon[]>;
    },
  });

  const toPayload = (f: AddonFormState) => ({
    name: f.name,
    description: f.description || null,
    feature_keys: f.feature_keys.split(",").map(s => s.trim()).filter(Boolean),
    monthly_price: Number(f.monthly_price) || 0,
    annual_price: Number(f.annual_price) || 0,
    stripe_price_id: f.stripe_price_id || null,
    stripe_price_id_annual: f.stripe_price_id_annual || null,
    is_active: f.is_active,
    is_per_seat: f.is_per_seat,
    sort_order: Number(f.sort_order) || 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) throw new Error("Failed to create add-on");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-addons"] });
      toast({ title: "Add-on created" });
      setShowNew(false);
      setForm(EMPTY_FORM);
      try { sessionStorage.removeItem("addon-form"); sessionStorage.removeItem("addon-showNew"); sessionStorage.removeItem("addon-editingId"); } catch {}
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/addons/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to update add-on (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-addons"] });
      toast({ title: "Add-on updated" });
      setEditingId(null);
      setForm(EMPTY_FORM);
      try { sessionStorage.removeItem("addon-form"); sessionStorage.removeItem("addon-showNew"); sessionStorage.removeItem("addon-editingId"); } catch {}
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/platform/addons/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete add-on");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-addons"] });
      toast({ title: "Add-on deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (addon: Addon) => {
    setForm({
      name: addon.name,
      description: addon.description || "",
      feature_keys: (addon.feature_keys || []).join(", "),
      monthly_price: addon.monthly_price,
      annual_price: addon.annual_price,
      stripe_price_id: addon.stripe_price_id || "",
      stripe_price_id_annual: addon.stripe_price_id_annual || "",
      is_active: addon.is_active,
      is_per_seat: !!(addon as Record<string, unknown>).is_per_seat,
      sort_order: addon.sort_order,
    });
    setEditingId(addon.id);
    setShowNew(false);
  };

  const renderAddonForm = (isNew: boolean) => (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-4">
        <p className="text-sm font-bold">{isNew ? "New Add-on" : "Edit Add-on"}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Add-on name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Feature Keys</Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_FEATURE_KEYS.map(({ key, label, description }) => {
              const currentKeys = form.feature_keys.split(",").map(s => s.trim()).filter(Boolean);
              const isSelected = currentKeys.includes(key);
              const FEATURE_DEPS: Record<string, { requires: string[]; message: string }> = {
                accounting_integration: { requires: ["time_attended", "parts_used"], message: "Requires Time Attended and/or Parts Used" },
              };
              const dep = FEATURE_DEPS[key];
              const isDisabled = dep ? !dep.requires.some(r => currentKeys.includes(r)) : false;
              return (
                <button
                  key={key}
                  type="button"
                  title={isDisabled && dep ? dep.message : description}
                  disabled={isDisabled}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${isDisabled ? "bg-muted/30 text-muted-foreground/50 border-border/50 cursor-not-allowed" : isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"}`}
                  onClick={() => {
                    if (isDisabled) return;
                    if (isSelected) {
                      let keysToRemove = [key];
                      const dependents = Object.entries(FEATURE_DEPS).filter(([, d]) => d.requires.includes(key));
                      for (const [depKey, depVal] of dependents) {
                        const remainingReqs = depVal.requires.filter(r => r !== key);
                        if (!remainingReqs.some(r => currentKeys.includes(r))) {
                          keysToRemove.push(depKey);
                        }
                      }
                      const updated = currentKeys.filter(k => !keysToRemove.includes(k)).join(", ");
                      setForm({ ...form, feature_keys: updated });
                    } else {
                      const updated = [...currentKeys, key].join(", ");
                      setForm({ ...form, feature_keys: updated });
                    }
                  }}
                >
                  {isSelected ? <Check className="w-3 h-3" /> : null}
                  {label}
                  {isDisabled && dep ? <span className="text-[10px] opacity-60 ml-1">(needs prerequisite)</span> : null}
                </button>
              );
            })}
          </div>
          <Input value={form.feature_keys} onChange={(e) => setForm({ ...form, feature_keys: e.target.value })} placeholder="Or type custom keys (comma-separated)" className="text-xs" />
          <p className="text-xs text-muted-foreground">Click to toggle, or type custom keys below. These control which features are unlocked.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Monthly Price (£)</Label>
            <Input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Annual Price (£)</Label>
            <Input type="number" step="0.01" value={form.annual_price} onChange={(e) => setForm({ ...form, annual_price: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sort Order</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label className="text-xs">Active</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.is_per_seat} onCheckedChange={(v) => setForm({ ...form, is_per_seat: v })} />
            <Label className="text-xs">Per-seat pricing</Label>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">Stripe Price IDs</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Monthly Price ID</Label>
              <Input value={form.stripe_price_id} onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })} placeholder="price_..." className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Annual Price ID</Label>
              <Input value={form.stripe_price_id_annual} onChange={(e) => setForm({ ...form, stripe_price_id_annual: e.target.value })} placeholder="price_..." className="font-mono text-xs" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => isNew ? createMutation.mutate() : updateMutation.mutate()}
            disabled={createMutation.isPending || updateMutation.isPending || !form.name}
          >
            <Save className="w-3 h-3 mr-1" />{isNew ? "Create" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setEditingId(null); setForm(EMPTY_FORM); try { sessionStorage.removeItem("addon-form"); sessionStorage.removeItem("addon-showNew"); sessionStorage.removeItem("addon-editingId"); } catch {} }}>
            <X className="w-3 h-3 mr-1" />Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
  const BASE_PLAN_ID = "37421994-c20d-49f8-aee1-a896e030a5f5";

  const { data: allPlans, refetch: refetchPlans } = useQuery({
    queryKey: ["platform-all-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const freePlan = (allPlans || []).find((p: { id: string }) => p.id === FREE_PLAN_ID) || null;
  const basePlan = (allPlans || []).find((p: { id: string }) => p.id === BASE_PLAN_ID) || null;

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "", description: "", monthly_price: "", annual_price: "", max_users: "", max_jobs_per_month: "",
    stripe_price_id: "", stripe_price_id_annual: "",
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/platform/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name,
          description: planForm.description || null,
          monthly_price: Number(planForm.monthly_price) || 0,
          annual_price: Number(planForm.annual_price) || 0,
          max_users: Number(planForm.max_users) || 1,
          max_jobs_per_month: Number(planForm.max_jobs_per_month) || 5,
          stripe_price_id: planForm.stripe_price_id || null,
          stripe_price_id_annual: planForm.stripe_price_id_annual || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update plan");
      return res.json();
    },
    onSuccess: () => {
      refetchPlans();
      toast({ title: "Plan updated" });
      setEditingPlanId(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function startEditingPlan(plan: Record<string, unknown>) {
    setPlanForm({
      name: String(plan.name || ""),
      description: String(plan.description || ""),
      monthly_price: String(plan.monthly_price ?? ""),
      annual_price: String(plan.annual_price ?? ""),
      max_users: String(plan.max_users ?? ""),
      max_jobs_per_month: String(plan.max_jobs_per_month ?? ""),
      stripe_price_id: String(plan.stripe_price_id || ""),
      stripe_price_id_annual: String(plan.stripe_price_id_annual || ""),
    });
    setEditingPlanId(String(plan.id));
  }

  function renderPlanCard(plan: Record<string, unknown> | null, label: string, icon: React.ReactNode, borderClass: string) {
    if (!plan) return null;
    const isEditing = editingPlanId === String(plan.id);
    return (
      <Card className={borderClass}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon} {label}
          </CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => startEditingPlan(plan)}>
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Plan Name</Label>
                  <Input value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monthly £</Label>
                  <Input type="number" step="0.01" value={planForm.monthly_price} onChange={e => setPlanForm({ ...planForm, monthly_price: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Annual £</Label>
                  <Input type="number" step="0.01" value={planForm.annual_price} onChange={e => setPlanForm({ ...planForm, annual_price: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Users</Label>
                  <Input type="number" value={planForm.max_users} onChange={e => setPlanForm({ ...planForm, max_users: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Jobs/Month</Label>
                  <Input type="number" value={planForm.max_jobs_per_month} onChange={e => setPlanForm({ ...planForm, max_jobs_per_month: e.target.value })} />
                </div>
              </div>
              {String(plan.id) !== FREE_PLAN_ID && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Stripe Price ID (Monthly)</Label>
                    <Input value={planForm.stripe_price_id} onChange={e => setPlanForm({ ...planForm, stripe_price_id: e.target.value })} placeholder="price_xxx" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stripe Price ID (Annual)</Label>
                    <Input value={planForm.stripe_price_id_annual} onChange={e => setPlanForm({ ...planForm, stripe_price_id_annual: e.target.value })} placeholder="price_xxx" />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updatePlanMutation.mutate(String(plan.id))} disabled={updatePlanMutation.isPending}>
                  <Save className="w-3 h-3 mr-1" /> {updatePlanMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingPlanId(null)}>
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span> <span className="font-medium">{String(plan.name)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Monthly:</span> <span className="font-medium">£{Number(plan.monthly_price).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Annual:</span> <span className="font-medium">£{Number(plan.annual_price).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Users:</span> <span className="font-medium">{String(plan.max_users)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Jobs/mo:</span> <span className="font-medium">{String(plan.max_jobs_per_month)}</span>
              </div>
              {plan.stripe_price_id && (
                <Badge variant="secondary" className="text-xs">Stripe configured</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Pricing & Add-ons</h1>
          <p className="text-muted-foreground">Manage base plan pricing and selectable add-on packages</p>
        </div>
        <Button onClick={() => { setShowNew(true); setForm(EMPTY_FORM); setEditingId(null); }}>
          <Plus className="w-4 h-4 mr-2" />New Add-on
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderPlanCard(freePlan, "Free Plan", <Package className="w-4 h-4 text-slate-500" />, "border-slate-200")}
        {renderPlanCard(basePlan, "Base Plan", <Settings className="w-4 h-4 text-primary" />, "border-primary/30")}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="w-4 h-4 text-amber-500" /> Trial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Duration:</span> <span className="font-medium">30 days</span>
              </div>
              <div>
                <span className="text-muted-foreground">Plan:</span> <span className="font-medium">{basePlan?.name || "Base Plan"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Add-ons:</span> <span className="font-medium">All included</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                New users get the Base Plan with all add-ons for 30 days. After expiry, they move to the Free Plan with add-ons deactivated.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold">Add-on Packages</h2>

      {showNew && renderAddonForm(true)}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(addons || []).map((addon) =>
            editingId === addon.id ? (
              <div key={addon.id}>{renderAddonForm(false)}</div>
            ) : (
              <Card key={addon.id} className={`${!addon.is_active ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-4 h-4" />{addon.name}
                    </CardTitle>
                    {addon.description && <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(addon)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                      if (confirm("Delete this add-on? This cannot be undone.")) deleteMutation.mutate(addon.id);
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly</span>
                    <span className="font-bold">&pound;{Number(addon.monthly_price).toFixed(2)}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual</span>
                    <span className="font-bold">&pound;{Number(addon.annual_price).toFixed(2)}/yr</span>
                  </div>
                  <div className="pt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Feature Keys</p>
                    <div className="flex flex-wrap gap-1">
                      {(addon.feature_keys || []).map(key => (
                        <Badge key={key} variant="secondary" className="text-xs font-mono">{key}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 space-y-1">
                    <Badge variant={addon.is_active ? "default" : "secondary"}>
                      {addon.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="pt-2 border-t text-xs space-y-1 text-muted-foreground">
                    <p className="font-medium text-foreground/60">Stripe</p>
                    <p className="font-mono truncate" title={addon.stripe_price_id || "Not set"}>
                      Monthly: {addon.stripe_price_id ? <span className="text-green-600">{addon.stripe_price_id}</span> : <span className="italic">Not set</span>}
                    </p>
                    <p className="font-mono truncate" title={addon.stripe_price_id_annual || "Not set"}>
                      Annual: {addon.stripe_price_id_annual ? <span className="text-green-600">{addon.stripe_price_id_annual}</span> : <span className="italic">Not set</span>}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
