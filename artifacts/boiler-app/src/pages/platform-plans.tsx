import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, X, Save, CreditCard, Trash2, Star } from "lucide-react";

interface PlanFeatures {
  forms: string;
  signatures: string;
  per_user_display: string;
  unlimited_jobs: boolean;
  scheduling: boolean;
  reports: boolean;
  photo_storage: string;
  compliance_forms: boolean;
  api_access: boolean;
  custom_branding: boolean;
  analytics: string;
  priority_support: boolean;
  social_media: boolean;
  job_management: boolean;
  invoicing: boolean;
  team_management: boolean;
  heat_pump_forms: boolean;
  oil_tank_forms: boolean;
  commissioning_forms: boolean;
  combustion_analysis: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  per_user_price: number | null;
  user_note: string | null;
  max_users: number;
  max_jobs_per_month: number;
  features: PlanFeatures;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  stripe_price_id: string | null;
  stripe_price_id_annual: string | null;
}

const DEFAULT_FEATURES: PlanFeatures = {
  forms: "Unlimited",
  signatures: "Unlimited",
  per_user_display: "Included",
  unlimited_jobs: true,
  scheduling: true,
  reports: true,
  photo_storage: "5 GB",
  compliance_forms: true,
  api_access: false,
  custom_branding: false,
  analytics: "",
  priority_support: false,
  social_media: false,
  job_management: true,
  invoicing: true,
  team_management: true,
  heat_pump_forms: true,
  oil_tank_forms: true,
  commissioning_forms: true,
  combustion_analysis: true,
};

const CORE_FEATURES: { key: keyof PlanFeatures; label: string }[] = [
  { key: "job_management", label: "Job Management" },
  { key: "scheduling", label: "Scheduling & Calendar" },
  { key: "invoicing", label: "Invoicing & Export" },
  { key: "reports", label: "Reports Dashboard" },
  { key: "team_management", label: "Team Management" },
  { key: "social_media", label: "Social Media Scheduling" },
];

const FORM_TYPE_FEATURES: { key: keyof PlanFeatures; label: string }[] = [
  { key: "heat_pump_forms", label: "Heat Pump Forms" },
  { key: "oil_tank_forms", label: "Oil Tank Forms" },
  { key: "commissioning_forms", label: "Commissioning Forms" },
  { key: "combustion_analysis", label: "Combustion Analysis" },
  { key: "compliance_forms", label: "Compliance Forms" },
];

const ADVANCED_FEATURES: { key: keyof PlanFeatures; label: string }[] = [
  { key: "unlimited_jobs", label: "Unlimited Jobs" },
  { key: "api_access", label: "API Access" },
  { key: "custom_branding", label: "Custom Branding" },
  { key: "priority_support", label: "Priority Support" },
];

const BOOL_FEATURES: { key: keyof PlanFeatures; label: string }[] = [
  ...CORE_FEATURES,
  ...FORM_TYPE_FEATURES,
  ...ADVANCED_FEATURES,
];

const TEXT_FEATURES: { key: keyof PlanFeatures; label: string; placeholder: string }[] = [
  { key: "forms", label: "Forms", placeholder: "e.g. Unlimited, 50/month" },
  { key: "signatures", label: "Signatures", placeholder: "e.g. Unlimited, 20/month" },
  { key: "per_user_display", label: "Per User Display", placeholder: "e.g. Included, £12 / user" },
  { key: "photo_storage", label: "Photo Storage", placeholder: "e.g. 5 GB, 25 GB, Unlimited" },
  { key: "analytics", label: "Analytics", placeholder: "e.g. Basic, Advanced, or leave blank" },
];

interface PlanFormState {
  name: string;
  description: string;
  monthly_price: number | string;
  annual_price: number | string;
  per_user_price: number | string;
  user_note: string;
  max_users: number | string;
  max_jobs_per_month: number | string;
  is_active: boolean;
  is_popular: boolean;
  features: PlanFeatures;
  stripe_price_id: string;
  stripe_price_id_annual: string;
}

const EMPTY_FORM: PlanFormState = {
  name: "",
  description: "",
  monthly_price: "",
  annual_price: "",
  per_user_price: "",
  user_note: "",
  max_users: "",
  max_jobs_per_month: "",
  is_active: true,
  is_popular: false,
  features: { ...DEFAULT_FEATURES },
  stripe_price_id: "",
  stripe_price_id_annual: "",
};

export default function PlatformPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Plan[]>;
    },
  });

  const toPayload = (f: PlanFormState) => ({
    name: f.name,
    description: f.description || null,
    monthly_price: Number(f.monthly_price) || 0,
    annual_price: Number(f.annual_price) || 0,
    per_user_price: f.per_user_price !== "" ? Number(f.per_user_price) : null,
    user_note: f.user_note || null,
    max_users: Number(f.max_users) || 5,
    max_jobs_per_month: Number(f.max_jobs_per_month) || 100,
    is_active: f.is_active,
    is_popular: f.is_popular,
    features: f.features,
    stripe_price_id: f.stripe_price_id || null,
    stripe_price_id_annual: f.stripe_price_id_annual || null,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
      toast({ title: "Plan created" });
      setShowNew(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/plans/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) throw new Error("Failed to update plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
      toast({ title: "Plan updated" });
      setEditingId(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/platform/plans/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete plan");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
      toast({ title: "Plan deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const syncStripeMutation = useMutation({
    mutationFn: async () => {
      const id = editingId;
      if (!id) throw new Error("No plan selected");
      const body: Record<string, string> = {};
      if (form.stripe_price_id) body.stripe_price_id = form.stripe_price_id;
      if (form.stripe_price_id_annual) body.stripe_price_id_annual = form.stripe_price_id_annual;
      const res = await fetch(`/api/platform/plans/${id}/sync-stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
      toast({ title: "Stripe Price IDs synced and validated" });
    },
    onError: (e) => toast({ title: "Sync error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      description: plan.description || "",
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      per_user_price: plan.per_user_price ?? "",
      user_note: plan.user_note || "",
      max_users: plan.max_users,
      max_jobs_per_month: plan.max_jobs_per_month,
      is_active: plan.is_active,
      is_popular: plan.is_popular ?? false,
      features: { ...DEFAULT_FEATURES, ...(plan.features || {}) },
      stripe_price_id: plan.stripe_price_id || "",
      stripe_price_id_annual: plan.stripe_price_id_annual || "",
    });
    setEditingId(plan.id);
    setShowNew(false);
  };

  const setFeature = (key: keyof PlanFeatures, value: string | boolean) => {
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  };

  const PlanForm = ({ isNew }: { isNew: boolean }) => (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-4">
        <p className="text-sm font-bold">{isNew ? "New Plan" : "Edit Plan"}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Plan name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. For solo engineers" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Base Price (£/mo)</Label>
            <Input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Per User (£/mo)</Label>
            <Input type="number" step="0.01" value={form.per_user_price} onChange={(e) => setForm({ ...form, per_user_price: e.target.value })} placeholder="Leave blank for flat rate" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Annual Price (£/yr)</Label>
            <Input type="number" step="0.01" value={form.annual_price} onChange={(e) => setForm({ ...form, annual_price: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">User Note</Label>
            <Input value={form.user_note} onChange={(e) => setForm({ ...form, user_note: e.target.value })} placeholder="e.g. Up to 10 users" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Max Users</Label>
            <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Jobs/Month</Label>
            <Input type="number" value={form.max_jobs_per_month} onChange={(e) => setForm({ ...form, max_jobs_per_month: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.is_popular} onCheckedChange={(v) => setForm({ ...form, is_popular: v })} />
            <Label className="text-xs">Popular Badge</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label className="text-xs">Active</Label>
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <Label className="text-xs font-semibold">Feature Values (text)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEXT_FEATURES.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  value={(form.features[key] as string) || ""}
                  onChange={(e) => setFeature(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold">Feature Gating</Label>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Core Features</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CORE_FEATURES.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form.features[key]} onChange={() => setFeature(key, !form.features[key])} className="rounded border-gray-300" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Form Types</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FORM_TYPE_FEATURES.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form.features[key]} onChange={() => setFeature(key, !form.features[key])} className="rounded border-gray-300" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Advanced</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ADVANCED_FEATURES.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form.features[key]} onChange={() => setFeature(key, !form.features[key])} className="rounded border-gray-300" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground">Stripe Price IDs</Label>
            {!isNew && (form.stripe_price_id || form.stripe_price_id_annual) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => syncStripeMutation.mutate()}
                disabled={syncStripeMutation.isPending}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                {syncStripeMutation.isPending ? "Validating\u2026" : "Sync with Stripe"}
              </Button>
            )}
          </div>
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
          <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setEditingId(null); setForm(EMPTY_FORM); }}>
            <X className="w-3 h-3 mr-1" />Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const featureDisplay = (features: PlanFeatures | null) => {
    if (!features) return null;
    const items: { label: string; value: string | boolean }[] = [
      ...TEXT_FEATURES.map(f => ({ label: f.label, value: (features[f.key] as string) || "" })),
      ...BOOL_FEATURES.map(f => ({ label: f.label, value: !!features[f.key] })),
    ];
    return items;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Pricing Plans</h1>
          <p className="text-muted-foreground">Manage subscription tiers and marketing page content</p>
        </div>
        <Button onClick={() => { setShowNew(true); setForm(EMPTY_FORM); setEditingId(null); }}>
          <Plus className="w-4 h-4 mr-2" />New Plan
        </Button>
      </div>

      {showNew && <PlanForm isNew />}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(plans || []).map((plan) =>
            editingId === plan.id ? (
              <PlanForm key={plan.id} isNew={false} />
            ) : (
              <Card key={plan.id} className={`${!plan.is_active ? "opacity-60" : ""} ${plan.is_popular ? "ring-2 ring-primary" : ""}`}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />{plan.name}
                      {plan.is_popular && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      {(plan as Record<string, unknown>).is_legacy && <Badge variant="outline" className="ml-1 text-amber-700 border-amber-300">Legacy</Badge>}
                    </CardTitle>
                    {plan.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(plan)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                      if (confirm("Delete this plan? This cannot be undone.")) deleteMutation.mutate(plan.id);
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Price</span>
                    <span className="font-bold">&pound;{Number(plan.monthly_price).toFixed(2)}/mo</span>
                  </div>
                  {plan.per_user_price != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Per User</span>
                      <span className="font-bold">+ &pound;{Number(plan.per_user_price).toFixed(2)}/user/mo</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual</span>
                    <span className="font-bold">&pound;{Number(plan.annual_price).toFixed(2)}/yr</span>
                  </div>
                  {plan.user_note && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span>{plan.user_note}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Users</span>
                    <span>{plan.max_users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Jobs/mo</span>
                    <span>{plan.max_jobs_per_month}</span>
                  </div>
                  <div className="pt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Features</p>
                    <div className="flex flex-wrap gap-1">
                      {featureDisplay(plan.features)?.map(({ label, value }) => (
                        <Badge
                          key={label}
                          variant={value ? "default" : "outline"}
                          className="text-xs"
                          title={typeof value === "string" ? value : undefined}
                        >
                          {label}{typeof value === "string" && value ? `: ${value}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 space-y-1">
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="pt-2 border-t text-xs space-y-1 text-muted-foreground">
                    <p className="font-medium text-foreground/60">Stripe</p>
                    <p className="font-mono truncate" title={plan.stripe_price_id || "Not set"}>
                      Monthly: {plan.stripe_price_id ? <span className="text-green-600">{plan.stripe_price_id}</span> : <span className="italic">Not set</span>}
                    </p>
                    <p className="font-mono truncate" title={plan.stripe_price_id_annual || "Not set"}>
                      Annual: {plan.stripe_price_id_annual ? <span className="text-green-600">{plan.stripe_price_id_annual}</span> : <span className="italic">Not set</span>}
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
