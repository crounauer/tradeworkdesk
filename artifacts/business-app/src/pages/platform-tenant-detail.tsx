import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, Users, Briefcase, Save, Ban, Play, XCircle, Trash2, ExternalLink, Package, AlertTriangle, MoreVertical, KeyRound, ShieldCheck, UserX, UserCheck, Zap, Plus, Check, Globe, RefreshCw, Eye } from "lucide-react";
import { Link } from "wouter";

const STATUS_OPTIONS = ["trial", "active", "payment_overdue", "suspended", "cancelled"];

const SUPERADMIN_OVERRIDE_MARKER = "superadmin_access_override=true";

function hasFreeAccessOverride(notes: string | null | undefined): boolean {
  return typeof notes === "string" && notes.includes(SUPERADMIN_OVERRIDE_MARKER);
}

export default function PlatformTenantDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{ action: string; status: string } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncingDomain, setSyncingDomain] = useState<string | null>(null);

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
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditAddon, setCreditAddon] = useState<{ id: string; name: string; credits_remaining: number; usage_unit_label: string | null } | null>(null);
  const [creditAmount, setCreditAmount] = useState<string>("1000");

  const grantFreeAccessMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}/grant-free-access`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to grant free access");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", params.id] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-addons", params.id] });
      toast({ title: "Trial access granted", description: "Tenant reactivated on trial with add-ons enabled." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeFreeAccessMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}/revoke-free-access`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke free access");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", params.id] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-addons", params.id] });
      toast({ title: "Access revoked", description: "Tenant suspended and add-ons deactivated." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const switchPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/platform/tenants/${params.id}/switch-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to switch plan"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", params.id] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Plan updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: websiteDomains, refetch: refetchDomains } = useQuery({
    queryKey: ["platform-tenant-domains", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}/website-domains`);
      if (!res.ok) return [];
      return res.json() as Promise<{ id: string; domain: string; verification_status: string; ssl_status: string; is_active: boolean; is_primary: boolean }[]>;
    },
    enabled: !!params.id,
  });

  const [reprovisioningSubdomain, setReprovisioningSubdomain] = useState(false);

  const syncDomainToRenderer = async (domain: string) => {
    setSyncingDomain(domain);
    try {
      const res = await fetch("/api/platform/domains/sync-renderer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast({ title: "Domain synced", description: `${domain} added to the Fly renderer` });
    } catch (e) {
      toast({ title: "Sync failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSyncingDomain(null);
    }
  };

  const reprovisionSubdomain = async () => {
    setReprovisioningSubdomain(true);
    try {
      const res = await fetch(`/api/platform/tenants/${params.id}/reprovision-subdomain`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reprovision failed");
      toast({ title: "Subdomain provisioned", description: `${data.domain} — ${data.action}` });
      refetchDomains();
    } catch (e) {
      toast({ title: "Reprovision failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setReprovisioningSubdomain(false);
    }
  };

  const { data: tenantCredits, refetch: refetchCredits } = useQuery({
    queryKey: ["platform-tenant-credits", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/platform/tenants/${params.id}/credits`);
      if (!res.ok) return [];
      return res.json() as Promise<{ id: string; name: string; usage_unit_label: string | null; usage_bundle_size: number | null; credits_remaining: number; total_purchased: number }[]>;
    },
    enabled: !!params.id,
  });

  const grantCreditsMutation = useMutation({
    mutationFn: async ({ addonId, credits }: { addonId: string; credits: number }) => {
      const res = await fetch(`/api/platform/tenants/${params.id}/credits/${addonId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to grant credits"); }
      return res.json();
    },
    onSuccess: (data: { credits_granted: number; new_balance: number }) => {
      refetchCredits();
      toast({ title: `${data.credits_granted.toLocaleString()} credits granted`, description: `New balance: ${data.new_balance.toLocaleString()}` });
      setShowCreditDialog(false);
      setCreditAddon(null);
      setCreditAmount("1000");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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

  const [deleteConfirmData, setDeleteConfirmData] = useState<{ user_count: number; users: { id: string; email: string }[] } | null>(null);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null); // userId

  const { data: userAddons } = useQuery<{ user_id: string; addons: { name: string } | null }[]>({
    queryKey: ["platform-tenant-user-addons", params.id],
    queryFn: () => fetch(`/api/platform/tenants/${params.id}/user-addons`).then(r => r.json()),
    enabled: !!params.id,
  });

  // Build a map: userId → addon name[]
  const userAddonMap: Record<string, string[]> = {};
  for (const ua of userAddons ?? []) {
    if (!userAddonMap[ua.user_id]) userAddonMap[ua.user_id] = [];
    if (ua.addons?.name) userAddonMap[ua.user_id].push(ua.addons.name);
  }

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      const res = await fetch(`/api/platform/tenants/${params.id}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Update failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", params.id] });
      toast({ title: "User updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/platform/tenants/${params.id}/users/${userId}/reset-password`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => toast({ title: "Password reset email sent" }),
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (confirmed?: boolean) => {
      const url = confirmed
        ? `/api/platform/tenants/${params.id}?confirm=true`
        : `/api/platform/tenants/${params.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        if (data.error === "confirm_required") {
          setDeleteConfirmData({ user_count: data.user_count, users: data.users });
          throw new Error("__confirm_required__");
        }
      }
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
    onError: (e) => {
      if (e.message === "__confirm_required__") return;
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
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
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={
              tenant.status === "active" ? "bg-green-100 text-green-700" :
              tenant.status === "trial" ? "bg-amber-100 text-amber-700" :
              tenant.status === "payment_overdue" ? "bg-orange-100 text-orange-700" :
              tenant.status === "suspended" ? "bg-red-100 text-red-700" : ""
            }>{tenant.status?.replace("_", " ")}</Badge>
            {hasFreeAccessOverride(tenant.notes) && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">Free</Badge>
            )}
          </div></div>
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
            {hasFreeAccessOverride(tenant.notes) ? (
              <Button
                variant="outline"
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={() => revokeFreeAccessMutation.mutate()}
                disabled={revokeFreeAccessMutation.isPending}
              >
                <Package className="w-4 h-4 mr-2" />
                {revokeFreeAccessMutation.isPending ? "Revoking…" : "Revoke Free Access"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => grantFreeAccessMutation.mutate()}
                disabled={grantFreeAccessMutation.isPending}
              >
                <Package className="w-4 h-4 mr-2" />
                {grantFreeAccessMutation.isPending ? "Granting…" : "Grant Free Access"}
              </Button>
            )}
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => {
                localStorage.setItem("superadmin_readonly_tenant_id", tenant.id);
                window.location.href = "/";
              }}
            >
              <Eye className="w-4 h-4 mr-2" />View Read Only
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

      {/* Plan selector */}
      {plans && plans.filter((p: { id: string; monthly_price: number; is_legacy?: boolean }) => p.monthly_price > 0 && !p.is_legacy).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan</CardTitle>
            <p className="text-sm text-muted-foreground">Switch this tenant to a different plan. Takes effect immediately.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(plans as { id: string; name: string; monthly_price: number; annual_price: number; is_popular: boolean; is_legacy?: boolean }[])
                .filter(p => p.monthly_price > 0 && !p.is_legacy)
                .sort((a, b) => a.monthly_price - b.monthly_price)
                .map(plan => {
                  const isCurrent = tenant.plan_id === plan.id;
                  const isSwitching = switchPlanMutation.isPending;
                  const PlanIcon = plan.name === "Website Builder" ? Globe : plan.name === "Bundle" ? Package : Briefcase;
                  return (
                    <div key={plan.id} className={`relative rounded-xl border-2 p-4 flex flex-col gap-2 transition-all ${isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      {isCurrent && (
                        <div className="absolute -top-3 right-3">
                          <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">Current</Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <PlanIcon className={`w-4 h-4 ${isCurrent ? "text-primary" : "text-slate-500"}`} />
                        <span className="font-semibold text-sm">{plan.name}</span>
                      </div>
                      <div>
                        <span className="text-xl font-bold">£{Number(plan.monthly_price).toFixed(0)}</span>
                        <span className="text-muted-foreground text-xs">/mo</span>
                      </div>
                      {!isCurrent ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-1"
                          disabled={isSwitching}
                          onClick={() => switchPlanMutation.mutate(plan.id)}
                        >
                          {isSwitching ? "Switching…" : `Switch to ${plan.name}`}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-1">
                          <Check className="w-3.5 h-3.5" /> Active plan
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {tenant.users && tenant.users.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Users ({tenant.users.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {tenant.users.map((u: { id: string; full_name: string; email: string; role: string; is_active: boolean; created_at: string }) => (
                <div key={u.id} className="py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${u.is_active ? "bg-slate-100" : "bg-red-100 text-red-500"}`}>
                    {u.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{u.role.replace("_", " ")}</Badge>
                  {!u.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                  {(userAddonMap[u.id] ?? []).map(addonName => (
                    <Badge key={addonName} variant="secondary" className="text-xs hidden sm:inline-flex">{addonName}</Badge>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={userActionLoading === u.id}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => { setUserActionLoading(u.id); resetPasswordMutation.mutate(u.id, { onSettled: () => setUserActionLoading(null) }); }}
                      >
                        <KeyRound className="w-4 h-4 mr-2" /> Send Password Reset
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.role === "technician" ? (
                        <DropdownMenuItem
                          onClick={() => { setUserActionLoading(u.id); updateUserMutation.mutate({ userId: u.id, updates: { role: "admin" } }, { onSettled: () => setUserActionLoading(null) }); }}
                        >
                          <ShieldCheck className="w-4 h-4 mr-2" /> Promote to Admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => { setUserActionLoading(u.id); updateUserMutation.mutate({ userId: u.id, updates: { role: "technician" } }, { onSettled: () => setUserActionLoading(null) }); }}
                        >
                          <ShieldCheck className="w-4 h-4 mr-2" /> Demote to Technician
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {u.is_active ? (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => { setUserActionLoading(u.id); updateUserMutation.mutate({ userId: u.id, updates: { is_active: false } }, { onSettled: () => setUserActionLoading(null) }); }}
                        >
                          <UserX className="w-4 h-4 mr-2" /> Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-green-600 focus:text-green-600"
                          onClick={() => { setUserActionLoading(u.id); updateUserMutation.mutate({ userId: u.id, updates: { is_active: true } }, { onSettled: () => setUserActionLoading(null) }); }}
                        >
                          <UserCheck className="w-4 h-4 mr-2" /> Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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

      {/* Usage Credits */}
      {tenantCredits && tenantCredits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Usage Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tenantCredits.map(credit => {
                const isLow = credit.credits_remaining < 50;
                return (
                  <div key={credit.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{credit.name}</p>
                      <p className={`text-lg font-bold ${isLow ? "text-orange-600" : "text-slate-800"}`}>
                        {credit.credits_remaining.toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          {credit.usage_unit_label ?? "credits"} remaining
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {credit.total_purchased.toLocaleString()} purchased total
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      onClick={() => {
                        setCreditAddon({ id: credit.id, name: credit.name, credits_remaining: credit.credits_remaining, usage_unit_label: credit.usage_unit_label });
                        setCreditAmount("1000");
                        setShowCreditDialog(true);
                      }}
                    >
                      <Plus className="w-3 h-3" /> Grant
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Website Domains — always show so we can reprovision missing subdomains */}
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" /> Website Domains
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={reprovisioningSubdomain}
                onClick={reprovisionSubdomain}
                title="Create or re-activate the platform subdomain for this tenant"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${reprovisioningSubdomain ? "animate-spin" : ""}`} />
                {reprovisioningSubdomain ? "Provisioning…" : "Reprovision subdomain"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!websiteDomains || websiteDomains.length === 0) ? (
              <p className="text-sm text-muted-foreground">No domains found. Use "Reprovision subdomain" to create one.</p>
            ) : (
            <div className="divide-y">
              {websiteDomains.map(d => (
                <div key={d.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono">{d.domain}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={`text-xs ${
                        d.verification_status === "verified" ? "bg-green-50 text-green-700 border-green-200" :
                        d.verification_status === "failed" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>{d.verification_status}</Badge>
                      <Badge variant="outline" className={`text-xs ${
                        d.ssl_status === "active" ? "bg-green-50 text-green-700 border-green-200" :
                        d.ssl_status === "failed" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-slate-50 text-slate-600"
                      }`}>SSL: {d.ssl_status}</Badge>
                      {d.is_active && <Badge className="text-xs bg-green-600 text-white">Active</Badge>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncingDomain === d.domain}
                              onClick={() => syncDomainToRenderer(d.domain)}
                    title="Force-add this domain to Vercel renderer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingDomain === d.domain ? "animate-spin" : ""}`} />
                    {syncingDomain === d.domain ? "Syncing…" : "Sync to Vercel"}
                  </Button>
                </div>
              ))}
            </div>
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

      {/* Grant Credits Dialog */}
      <Dialog open={showCreditDialog} onOpenChange={(open) => { if (!open) { setShowCreditDialog(false); setCreditAddon(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Grant Credits — {creditAddon?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Current balance: </span>
              <span className="font-bold">{creditAddon?.credits_remaining.toLocaleString() ?? 0}</span>
              <span className="text-muted-foreground ml-1">{creditAddon?.usage_unit_label ?? "credits"}</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Credits to grant</Label>
              <Input
                type="number"
                min={1}
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                placeholder="e.g. 1000"
              />
              <p className="text-xs text-muted-foreground">These are added free of charge directly to the tenant's balance.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreditDialog(false); setCreditAddon(null); }}>Cancel</Button>
            <Button
              disabled={grantCreditsMutation.isPending || !creditAddon || !Number(creditAmount)}
              onClick={() => {
                if (!creditAddon) return;
                grantCreditsMutation.mutate({ addonId: creditAddon.id, credits: Math.floor(Number(creditAmount)) });
              }}
            >
              {grantCreditsMutation.isPending ? "Granting..." : `Grant ${Number(creditAmount) > 0 ? Number(creditAmount).toLocaleString() : ""} credits`}
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
              ? `Are you sure you want to permanently delete "${tenant.company_name}"? This cannot be undone.`
              : `Are you sure you want to ${confirmAction?.action?.toLowerCase()} "${tenant.company_name}"? This will change their status to "${confirmAction?.status}".`
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={updateMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                setConfirmAction(null);
                if (confirmAction?.status === "__delete__") {
                  deleteMutation.mutate(false);
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

      <Dialog open={!!deleteConfirmData} onOpenChange={() => setDeleteConfirmData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Company & All Users</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>"{tenant.company_name}"</strong> has <strong>{deleteConfirmData?.user_count}</strong> user(s) that will be permanently deleted:
            </p>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
              {deleteConfirmData?.users.map(u => (
                <div key={u.id} className="text-sm flex items-center gap-2 py-1 px-2 bg-red-50 rounded">
                  <span className="text-red-600 font-mono text-xs">✕</span>
                  <span>{u.email}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-red-600">
              This will permanently delete the company, all users, add-ons, and settings. This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmData(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                setDeleteConfirmData(null);
                deleteMutation.mutate(true);
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : `Delete Company & ${deleteConfirmData?.user_count} User(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
