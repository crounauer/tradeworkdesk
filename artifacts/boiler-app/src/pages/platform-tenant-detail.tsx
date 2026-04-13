import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, Users, Briefcase, Save, Ban, Play, XCircle, Trash2, ExternalLink, Package, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

const STATUS_OPTIONS = ["trial", "active", "payment_overdue", "suspended", "cancelled"];

export default function PlatformTenantDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{ action: string; status: string } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["platform-tenant", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}`);
      if (!res.ok) throw new Error("Tenant not found");
      return res.json();
    },
    enabled: !!params.id,
  });

  const { data: plans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const res = await fetch("/api/platform/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  const { data: allAddons } = useQuery({
    queryKey: ["platform-addons"],
    queryFn: async () => {
      const res = await fetch("/api/platform/addons");
      if (!res.ok) throw new Error("Failed to load addons");
      return res.json();
    },
  });

  const { data: tenantAddons, refetch: refetchTenantAddons } = useQuery({
    queryKey: ["platform-tenant-addons", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}/addons`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!params.id,
  });

  const [addonSelections, setAddonSelections] = useState<Set<string>>(new Set());
  const [showAddonEditor, setShowAddonEditor] = useState(false);

  const grantFreeAccessMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}/grant-free-access`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to grant free access");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", params.id] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-addons", params.id] });
      toast({ title: "Free access granted", description: "Base Plan + all add-ons activated at no cost." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveAddonsMutation = useMutation({
    mutationFn: async (addonIds: string[]) => {
      const res = await fetch(`/api/platform/tenants/${params.id}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon_ids: addonIds }),
      });
      if (!res.ok) throw new Error("Failed to update add-ons");
      return res.json();
    },
    onSuccess: () => {
      refetchTenantAddons();
      toast({ title: "Tenant add-ons updated" });
      setShowAddonEditor(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/platform/tenants/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", params.id] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Tenant updated" });
      setEditing(false);
      setConfirmAction(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Tenant deleted" });
      navigate("/platform/tenants");
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-slate-100 rounded" /><div className="h-48 bg-slate-100 rounded" /></div>;
  }

  if (!tenant) {
    return <div className="text-center py-8 text-muted-foreground">Tenant not found</div>;
  }

  const startEdit = () => {
    setForm({
      company_name: tenant.company_name || "",
      contact_name: tenant.contact_name || "",
      contact_email: tenant.contact_email || "",
      contact_phone: tenant.contact_phone || "",
      status: tenant.status || "trial",
      plan_id: tenant.plan_id || "",
      notes: tenant.notes || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const handleStatusAction = (action: string, status: string) => {
    setConfirmAction({ action, status });
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/platform/tenants/${params.id}/billing-portal`);
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Cannot open portal", description: err.error, variant: "destructive" });
        return;
      }
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch {
      toast({ title: "Error opening billing portal", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const confirmStatusChange = () => {
    if (confirmAction) {
      updateMutation.mutate({ status: confirmAction.status });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/platform/tenants")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">{tenant.company_name}</h1>
          <p className="text-muted-foreground text-sm">Tenant ID: {tenant.id}</p>
        </div>
        {!editing ? (
          <Button onClick={startEdit}>Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />Save
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-blue-500" />
          <div><p className="text-sm text-muted-foreground">Status</p>
          <Badge variant="secondary" className={
            tenant.status === "active" ? "bg-green-100 text-green-700" :
            tenant.status === "trial" ? "bg-amber-100 text-amber-700" :
            tenant.status === "payment_overdue" ? "bg-orange-100 text-orange-700" :
            tenant.status === "suspended" ? "bg-red-100 text-red-700" : ""
          }>{tenant.status?.replace("_", " ")}</Badge></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-purple-500" />
          <div><p className="text-sm text-muted-foreground">Users</p>
          <p className="font-bold">{tenant.users?.length || 0}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-green-500" />
          <div><p className="text-sm text-muted-foreground">Customers / Jobs</p>
          <p className="font-bold">{tenant.customer_count || 0} / {tenant.job_count || 0}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => grantFreeAccessMutation.mutate()}
              disabled={grantFreeAccessMutation.isPending}
            >
              <Package className="w-4 h-4 mr-2" />
              {grantFreeAccessMutation.isPending ? "Granting…" : "Grant Free Access"}
            </Button>
            {tenant.stripe_customer_id && (
              <Button variant="outline" onClick={openBillingPortal} disabled={portalLoading}>
                <ExternalLink className="w-4 h-4 mr-2" />{portalLoading ? "Opening…" : "Billing Portal"}
              </Button>
            )}
            {tenant.status !== "suspended" && tenant.status !== "payment_overdue" && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleStatusAction("Suspend", "suspended")}>
                <Ban className="w-4 h-4 mr-2" />Suspend
              </Button>
            )}
            {(tenant.status === "suspended" || tenant.status === "payment_overdue" || tenant.status === "cancelled") && (
              <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleStatusAction("Reactivate", "active")}>
                <Play className="w-4 h-4 mr-2" />Reactivate
              </Button>
            )}
            {tenant.status !== "cancelled" && (
              <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleStatusAction("Cancel", "cancelled")}>
                <XCircle className="w-4 h-4 mr-2" />Cancel Subscription
              </Button>
            )}
            <Button variant="outline" className="text-red-700 border-red-300 hover:bg-red-50" onClick={() => setConfirmAction({ action: "Delete", status: "__delete__" })}>
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.plan_id}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                >
                  <option value="">No plan</option>
                  {(plans || []).map((p: { id: string; name: string }) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Company:</span> {tenant.company_name}</div>
              <div><span className="text-muted-foreground">Contact:</span> {tenant.contact_name}</div>
              <div><span className="text-muted-foreground">Email:</span> {tenant.contact_email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {tenant.contact_phone || "—"}</div>
              <div><span className="text-muted-foreground">Plan:</span> {tenant.plans?.name || "No plan"}</div>
              <div><span className="text-muted-foreground">Created:</span> {new Date(tenant.created_at).toLocaleDateString()}</div>
              {tenant.trial_ends_at && (
                <div><span className="text-muted-foreground">Trial Ends:</span> {new Date(tenant.trial_ends_at).toLocaleDateString()}</div>
              )}
              {tenant.notes && (
                <div className="md:col-span-2"><span className="text-muted-foreground">Notes:</span> {tenant.notes}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {tenant.users && tenant.users.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Users ({tenant.users.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {tenant.users.map((u: { id: string; full_name: string; email: string; role: string; created_at: string }) => (
                <div key={u.id} className="py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold">
                    {u.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{u.role.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Add-ons
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => {
            const activeIds = (tenantAddons || [])
              .filter((ta: { is_active: boolean }) => ta.is_active)
              .map((ta: { addon_id: string }) => ta.addon_id);
            setAddonSelections(new Set(activeIds));
            setShowAddonEditor(true);
          }}>
            Manage Add-ons
          </Button>
        </CardHeader>
        <CardContent>
          {allAddons && allAddons.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(allAddons as { id: string; name: string; is_active: boolean }[])
                .filter((a) => a.is_active)
                .map((addon) => {
                  const isEnabled = (tenantAddons || []).some(
                    (ta: { addon_id: string; is_active: boolean }) => ta.addon_id === addon.id && ta.is_active
                  );
                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                        isEnabled
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-slate-200 bg-slate-50 text-muted-foreground"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isEnabled ? "bg-green-500" : "bg-slate-300"}`} />
                      {addon.name}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No add-ons available</p>
          )}
        </CardContent>
      </Card>

      {tenant.plan_id && (plans || []).some((p: { id: string; is_legacy?: boolean }) =>
        p.id === tenant.plan_id && p.is_legacy
      ) && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <strong>Legacy plan detected.</strong> This tenant is on an older pricing tier. Consider migrating them to the base + add-ons model.
          </div>
        </div>
      )}

      <Dialog open={showAddonEditor} onOpenChange={setShowAddonEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Tenant Add-ons</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(allAddons || []).map((addon: { id: string; name: string; description: string | null; is_active: boolean }) => (
              <label key={addon.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                addonSelections.has(addon.id) ? "border-primary bg-primary/5" : "border-slate-200"
              }`}>
                <input
                  type="checkbox"
                  checked={addonSelections.has(addon.id)}
                  onChange={() => {
                    setAddonSelections(prev => {
                      const next = new Set(prev);
                      if (next.has(addon.id)) next.delete(addon.id);
                      else next.add(addon.id);
                      return next;
                    });
                  }}
                  className="rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{addon.name}</p>
                  {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                </div>
                {!addon.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddonEditor(false)}>Cancel</Button>
            <Button
              onClick={() => saveAddonsMutation.mutate([...addonSelections])}
              disabled={saveAddonsMutation.isPending}
            >
              {saveAddonsMutation.isPending ? "Saving..." : "Save Add-ons"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {confirmAction?.action}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.status === "__delete__"
              ? `Are you sure you want to permanently delete "${tenant.company_name}"? This cannot be undone. Tenants with active users cannot be deleted.`
              : `Are you sure you want to ${confirmAction?.action?.toLowerCase()} "${tenant.company_name}"? This will change their status to "${confirmAction?.status}".`
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={updateMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                if (confirmAction?.status === "__delete__") {
                  deleteMutation.mutate();
                } else {
                  confirmStatusChange();
                }
              }}
            >
              {confirmAction?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
