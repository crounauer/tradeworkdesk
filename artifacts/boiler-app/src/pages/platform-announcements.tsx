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
}

const EMPTY_FORM: AnnouncementForm = { title: "", body: "", severity: "info", starts_at: "", ends_at: "" };

export default function PlatformAnnouncements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM);

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

  const startEdit = (a: { id: string; title: string; body: string; severity: string; starts_at: string; ends_at: string | null }) => {
    setForm({
      title: a.title,
      body: a.body,
      severity: a.severity,
      starts_at: a.starts_at ? a.starts_at.substring(0, 16) : "",
      ends_at: a.ends_at ? a.ends_at.substring(0, 16) : "",
    });
    setEditingId(a.id);
    setShowNew(false);
  };

  const AnnouncementFormUI = ({ isNew }: { isNew: boolean }) => (
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
        <div className="flex gap-2">
          <Button
            onClick={() => isNew ? createMutation.mutate() : updateMutation.mutate()}
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

      {showNew && <AnnouncementFormUI isNew />}

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-4"><div className="h-16 bg-slate-100 rounded animate-pulse" /></CardContent></Card>)}</div>
      ) : !announcements || announcements.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No announcements yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: { id: string; title: string; body: string; severity: string; is_active: boolean; starts_at: string; ends_at: string | null; created_at: string }) => (
            editingId === a.id ? (
              <AnnouncementFormUI key={a.id} isNew={false} />
            ) : (
              <Card key={a.id} className={!a.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={SEVERITY_COLORS[a.severity]}>{a.severity}</Badge>
                        {!a.is_active && <Badge variant="outline">Disabled</Badge>}
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
