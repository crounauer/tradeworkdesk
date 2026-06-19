import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Megaphone, X, Pencil, Save } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

interface AnnouncementForm {
  title: string;
  body: string;
  severity: string;
  starts_at: string;
  ends_at: string;
  target_scope: "all_tenants" | "specific_tenants";
  target_tenant_ids: string[];
  target_admin_dashboard: boolean;
  target_websites: boolean;
}

const EMPTY_FORM: AnnouncementForm = {
  title: "",
  body: "",
  severity: "info",
  starts_at: "",
  ends_at: "",
  target_scope: "all_tenants",
  target_tenant_ids: [],
  target_admin_dashboard: true,
  target_websites: false,
};

export default function PlatformAnnouncements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM);
  const [tenantSearch, setTenantSearch] = useState("");

  const { data: tenants } = useQuery({
    queryKey: ["platform-tenants-for-announcements"],
    queryFn: async () => {
      const res = await fetch("/api/platform/tenants");
      if (!res.ok) throw new Error("Failed to load tenants");
      const data = await res.json() as Array<{ id: string; company_name?: string; contact_email?: string }>;
      return (data || []).map((tenant) => ({
        id: String(tenant.id),
        label: String(tenant.company_name || tenant.contact_email || tenant.id),
      }));
    },
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: async () => {
      const res = await fetch("/api/platform/announcements");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          target_tenant_ids: form.target_scope === "specific_tenants" ? form.target_tenant_ids : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      toast({ title: "Announcement created" });
      setShowNew(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform/announcements/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          severity: form.severity,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          target_tenant_ids: form.target_scope === "specific_tenants" ? form.target_tenant_ids : null,
          target_admin_dashboard: form.target_admin_dashboard,
          target_websites: form.target_websites,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      toast({ title: "Announcement updated" });
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/platform/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/platform/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-announcements"] }),
  });

  const startEdit = (a: { id: string; title: string; body: string; severity: string; starts_at: string; ends_at: string | null; target_tenant_ids?: string[] | null; target_admin_dashboard?: boolean; target_websites?: boolean }) => {
    const targetTenantIds = Array.isArray(a.target_tenant_ids) ? a.target_tenant_ids : [];
    setForm({
      title: a.title,
      body: a.body,
      severity: a.severity,
      starts_at: a.starts_at ? a.starts_at.substring(0, 16) : "",
      ends_at: a.ends_at ? a.ends_at.substring(0, 16) : "",
      target_scope: targetTenantIds.length > 0 ? "specific_tenants" : "all_tenants",
      target_tenant_ids: targetTenantIds,
      target_admin_dashboard: a.target_admin_dashboard ?? true,
      target_websites: a.target_websites ?? false,
    });
    setEditingId(a.id);
    setShowNew(false);
  };

  const toggleTargetTenant = (tenantId: string) => {
    setForm((prev) => {
      const isSelected = prev.target_tenant_ids.includes(tenantId);
      return {
        ...prev,
        target_tenant_ids: isSelected
          ? prev.target_tenant_ids.filter((id) => id !== tenantId)
          : [...prev.target_tenant_ids, tenantId],
      };
    });
  };

  const handleSubmit = (isNew: boolean) => {
    if (!form.target_admin_dashboard && !form.target_websites) {
      toast({ title: "Select at least one channel", description: "Choose dashboard, website, or both.", variant: "destructive" });
      return;
    }

    if (form.target_scope === "specific_tenants" && form.target_tenant_ids.length === 0) {
      toast({ title: "Select at least one tenant", description: "Choose one or more tenants for targeted broadcast.", variant: "destructive" });
      return;
    }

    if (isNew) {
      createMutation.mutate();
      return;
    }
    updateMutation.mutate();
  };

  const renderAnnouncementForm = (isNew: boolean) => (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-bold">{isNew ? "New Announcement" : "Edit Announcement"}</p>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Announcement body..."
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Severity</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Starts At</Label>
            <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Ends At (optional)</Label>
            <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Broadcast Channels</Label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.target_admin_dashboard}
                onChange={(e) => setForm({ ...form, target_admin_dashboard: e.target.checked })}
              />
              Tenant admin dashboard
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.target_websites}
                onChange={(e) => setForm({ ...form, target_websites: e.target.checked })}
              />
              Tenant website
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tenants</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.target_scope}
            onChange={(e) => setForm({ ...form, target_scope: e.target.value as "all_tenants" | "specific_tenants" })}
          >
            <option value="all_tenants">All tenants</option>
            <option value="specific_tenants">Specific tenant(s)</option>
          </select>

          {form.target_scope === "specific_tenants" && (
            <div className="space-y-2 rounded-md border border-input p-3">
              <Input
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Search tenant name..."
              />
              <div className="max-h-40 overflow-auto space-y-2">
                {(tenants || [])
                  .filter((tenant) => tenant.label.toLowerCase().includes(tenantSearch.toLowerCase()))
                  .map((tenant) => (
                    <label key={tenant.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.target_tenant_ids.includes(tenant.id)}
                        onChange={() => toggleTargetTenant(tenant.id)}
                      />
                      {tenant.label}
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => handleSubmit(isNew)}
            disabled={createMutation.isPending || updateMutation.isPending || !form.title || !form.body}
          >
            <Save className="w-3 h-3 mr-1" />{isNew ? "Publish" : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={() => { setShowNew(false); setEditingId(null); setForm(EMPTY_FORM); }}>
            <X className="w-4 h-4 mr-1" />Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Announcements</h1>
          <p className="text-muted-foreground">Platform-wide notifications for all users</p>
        </div>
        <Button onClick={() => { setShowNew(true); setEditingId(null); setForm(EMPTY_FORM); }}>
          <Plus className="w-4 h-4 mr-2" />New Announcement
        </Button>
      </div>

      {showNew && renderAnnouncementForm(true)}

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-4"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : !announcements || announcements.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No announcements yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: { id: string; title: string; body: string; severity: string; is_active: boolean; starts_at: string; ends_at: string | null; created_at: string; target_tenant_ids?: string[] | null; target_admin_dashboard?: boolean; target_websites?: boolean }) => (
            editingId === a.id ? (
              <div key={a.id}>{renderAnnouncementForm(false)}</div>
            ) : (
              <Card key={a.id} className={!a.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={SEVERITY_COLORS[a.severity]}>{a.severity}</Badge>
                        {!a.is_active && <Badge variant="outline">Disabled</Badge>}
                        {a.target_admin_dashboard && <Badge variant="outline">Dashboard</Badge>}
                        {a.target_websites && <Badge variant="outline">Website</Badge>}
                        {Array.isArray(a.target_tenant_ids) && a.target_tenant_ids.length > 0
                          ? <Badge variant="outline">{a.target_tenant_ids.length} tenant(s)</Badge>
                          : <Badge variant="outline">All tenants</Badge>}
                      </div>
                      <h3 className="font-medium">{a.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Created {new Date(a.created_at).toLocaleDateString()}
                        {a.ends_at && ` · Ends ${new Date(a.ends_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(a)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: a.id, is_active: !a.is_active })}
                      >
                        {a.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  );
}
