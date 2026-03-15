import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, X, Save, CreditCard, Trash2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_jobs_per_month: number;
  is_active: boolean;
  sort_order: number;
  stripe_price_id: string | null;
}

export default function PlatformPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  const { data: plans, isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Plan[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/platform/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
      toast({ title: "Plan created" });
      setShowNew(false);
      setForm({});
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/platform/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const startEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      description: plan.description || "",
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      max_users: plan.max_users,
      max_jobs_per_month: plan.max_jobs_per_month,
      is_active: plan.is_active,
    });
    setEditingId(plan.id);
  };

  const PlanForm = ({ isNew }: { isNew: boolean }) => (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={form.name as string || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Plan name" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={form.description as string || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monthly Price</Label>
            <Input type="number" step="0.01" value={form.monthly_price ?? ""} onChange={(e) => setForm({ ...form, monthly_price: parseFloat(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Annual Price</Label>
            <Input type="number" step="0.01" value={form.annual_price ?? ""} onChange={(e) => setForm({ ...form, annual_price: parseFloat(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Users</Label>
            <Input type="number" value={form.max_users ?? ""} onChange={(e) => setForm({ ...form, max_users: parseInt(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Jobs/Month</Label>
            <Input type="number" value={form.max_jobs_per_month ?? ""} onChange={(e) => setForm({ ...form, max_jobs_per_month: parseInt(e.target.value) })} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => isNew ? createMutation.mutate(form) : updateMutation.mutate({ id: editingId, ...form })}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="w-3 h-3 mr-1" />{isNew ? "Create" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setEditingId(null); setForm({}); }}>
            <X className="w-3 h-3 mr-1" />Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Pricing Plans</h1>
          <p className="text-muted-foreground">Manage subscription tiers</p>
        </div>
        <Button onClick={() => { setShowNew(true); setForm({}); setEditingId(null); }}>
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
              <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />{plan.name}
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
                    <span className="text-muted-foreground">Monthly</span>
                    <span className="font-bold">&pound;{Number(plan.monthly_price).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual</span>
                    <span className="font-bold">&pound;{Number(plan.annual_price).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Users</span>
                    <span>{plan.max_users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Jobs/mo</span>
                    <span>{plan.max_jobs_per_month}</span>
                  </div>
                  <div className="pt-2">
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
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
