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

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  per_user_price: number | null;
  max_users: number;
  features?: Record<string, unknown> | null;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  stripe_price_id: string | null;
  stripe_price_id_annual: string | null;
}

interface PlanFormState {
  name: string;
  description: string;
  monthly_price: number | string;
  annual_price: number | string;
  per_user_price: number | string;
  max_users: number | string;
  is_active: boolean;
  is_popular: boolean;
  stripe_price_id: string;
  stripe_price_id_annual: string;
}

const EMPTY_FORM: PlanFormState = {
  name: "",
  description: "",
  monthly_price: "",
  annual_price: "",
  per_user_price: "",
  max_users: "",
  is_active: true,
  is_popular: false,
  stripe_price_id: "",
  stripe_price_id_annual: "",
};

interface PlanFormProps {
  isNew: boolean;
  form: PlanFormState;
  setForm: (f: PlanFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onSyncStripe: () => void;
  isSaving: boolean;
  isSyncing: boolean;
}

function PlanForm({ isNew, form, setForm, onSave, onCancel, onSyncStripe, isSaving, isSyncing }: PlanFormProps) {
  return (
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
            <Input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Per User (£/mo)</Label>
            <Input type="number" step="0.01" value={form.per_user_price} onChange={(e) => setForm({ ...form, per_user_price: e.target.value })} onFocus={(e) => e.currentTarget.select()} placeholder="Leave blank for flat rate" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Annual Price (£/yr)</Label>
            <Input type="number" step="0.01" value={form.annual_price} onChange={(e) => setForm({ ...form, annual_price: e.target.value })} onFocus={(e) => e.currentTarget.select()} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Max Users</Label>
            <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} onFocus={(e) => e.currentTarget.select()} />
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

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground">Stripe Price IDs</Label>
            {!isNew && (form.stripe_price_id || form.stripe_price_id_annual) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={onSyncStripe}
                disabled={isSyncing}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                {isSyncing ? "Validating…" : "Sync with Stripe"}
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
          <Button size="sm" onClick={onSave} disabled={isSaving || !form.name}>
            <Save className="w-3 h-3 mr-1" />{isNew ? "Create" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="w-3 h-3 mr-1" />Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
    staleTime: 5 * 60 * 1000,      // 5 minutes
    refetchOnWindowFocus: false,   // don't disrupt an active edit
  });

  const toPayload = (f: PlanFormState) => ({
    name: f.name,
    description: f.description || null,
    monthly_price: Number(f.monthly_price) || 0,
    annual_price: Number(f.annual_price) || 0,
    per_user_price: f.per_user_price !== "" ? Number(f.per_user_price) : null,
    max_users: Number(f.max_users) || 5,
    is_active: f.is_active,
    is_popular: f.is_popular,
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
      max_users: plan.max_users,
      is_active: plan.is_active,
      is_popular: plan.is_popular ?? false,
      stripe_price_id: plan.stripe_price_id || "",
      stripe_price_id_annual: plan.stripe_price_id_annual || "",
    });
    setEditingId(plan.id);
    setShowNew(false);
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

      {showNew && (
        <PlanForm
          isNew
          form={form}
          setForm={setForm}
          onSave={() => createMutation.mutate()}
          onCancel={() => { setShowNew(false); setForm(EMPTY_FORM); }}
          onSyncStripe={() => {}}
          isSaving={createMutation.isPending}
          isSyncing={false}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(plans || []).map((plan) =>
            editingId === plan.id ? (
              <PlanForm
                key={plan.id}
                isNew={false}
                form={form}
                setForm={setForm}
                onSave={() => updateMutation.mutate()}
                onCancel={() => { setEditingId(null); setForm(EMPTY_FORM); }}
                onSyncStripe={() => syncStripeMutation.mutate()}
                isSaving={updateMutation.isPending}
                isSyncing={syncStripeMutation.isPending}
              />
            ) : (
              <Card key={plan.id} className={`${!plan.is_active ? "opacity-60" : ""} ${plan.is_popular ? "ring-2 ring-primary" : ""}`}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />{plan.name}
                      {plan.is_popular && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      {Boolean((plan as unknown as Record<string, unknown>).is_legacy) && <Badge variant="outline" className="ml-1 text-amber-700 border-amber-300">Legacy</Badge>}
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

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Users</span>
                    <span>{plan.max_users}</span>
                  </div>
                  <div className="pt-2 space-y-1">
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="pt-2 border-t text-xs space-y-1 text-muted-foreground">
                    <p className="font-medium text-foreground/60">Stripe</p>
                    <p className="font-mono truncate" title={plan.stripe_price_id || "Add Stripe monthly price ID in plan settings"}>
                      Monthly: {plan.stripe_price_id ? <span className="text-green-600">{plan.stripe_price_id}</span> : <span className="italic">Add Stripe monthly price ID in plan settings</span>}
                    </p>
                    <p className="font-mono truncate" title={plan.stripe_price_id_annual || "Add Stripe annual price ID in plan settings"}>
                      Annual: {plan.stripe_price_id_annual ? <span className="text-green-600">{plan.stripe_price_id_annual}</span> : <span className="italic">Add Stripe annual price ID in plan settings</span>}
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
