import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Pencil, Trash2, MessageSquare, Save } from "lucide-react";

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

const MAX_CHARS = 160;
const MAX_SENDER = 11;

export default function AdminSmsTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Sender name ──────────────────────────────────────────────
  const [senderName, setSenderName] = useState("");
  const [senderDirty, setSenderDirty] = useState(false);

  const { data: companySettings, isLoading: senderLoading } = useQuery<{ sms_sender_name?: string }>({
    queryKey: ["admin-company-settings"],
    queryFn: () => apiFetch("api/admin/company-settings") as Promise<{ sms_sender_name?: string }>,
  });

  // Sync senderName from fetched data only when the user hasn't made changes
  useEffect(() => {
    if (!senderDirty && companySettings) {
      setSenderName(companySettings.sms_sender_name ?? "");
    }
  }, [companySettings, senderDirty]);

  const saveSenderMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch("api/admin/company-settings", {
        method: "PUT",
        body: JSON.stringify({ sms_sender_name: name.trim().slice(0, MAX_SENDER) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-company-settings"] });
      setSenderDirty(false);
      toast({ title: "Sender name saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<SmsTemplate[]>({
    queryKey: ["sms-templates"],
    queryFn: () => apiFetch("api/sms/templates") as Promise<SmsTemplate[]>,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; content: string }) => {
      if (editingTemplate) {
        return apiFetch(`api/sms/templates/${editingTemplate.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("api/sms/templates", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
      toast({ title: editingTemplate ? "Template updated" : "Template created" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`api/sms/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
      toast({ title: "Template deleted" });
      setDeleteId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setContent("");
    setShowDialog(true);
  };

  const openEdit = (t: SmsTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setContent(t.content);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
    setName("");
    setContent("");
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!content.trim()) {
      toast({ title: "Message content is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ name: name.trim(), content: content.trim() });
  };

  const remaining = MAX_CHARS - content.length;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            SMS
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your SMS sender name and manage reusable message templates.
          </p>
        </div>
      </div>

      {/* ── Sender name ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sender Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Shown as the "From" name on recipients' phones. Maximum 11 characters — letters and numbers only (no spaces).
          </p>
          {senderLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-xs space-y-1">
                <Input
                  maxLength={MAX_SENDER}
                  placeholder="e.g. TradeWork"
                  value={senderName}
                  onChange={e => { setSenderName(e.target.value); setSenderDirty(true); }}
                />
                <p className="text-xs text-muted-foreground text-right">{senderName.length}/{MAX_SENDER}</p>
              </div>
              <Button
                onClick={() => saveSenderMutation.mutate(senderName)}
                disabled={saveSenderMutation.isPending || !senderDirty || !senderName.trim()}
              >
                {saveSenderMutation.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Templates ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Message Templates</h2>
            <p className="text-sm text-muted-foreground">Reusable messages you can select when sending an SMS.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium text-muted-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a template to quickly fill in common SMS messages.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <Card key={t.id} className="border border-border/50 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{t.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{t.content.length} characters</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>{/* end templates section */}

      {/* Create / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New SMS Template"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-name">Template name</Label>
              <Input
                id="tmpl-name"
                placeholder="e.g. Appointment reminder"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="tmpl-content">Message</Label>
                <span className={`text-xs ${remaining < 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  {remaining} chars remaining
                </span>
              </div>
              <Textarea
                id="tmpl-content"
                rows={5}
                placeholder="Type your template message here…"
                value={content}
                onChange={e => setContent(e.target.value)}
                className={remaining < 0 ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {content.length > MAX_CHARS && (
                <p className="text-xs text-destructive">Exceeds 160 characters — will send as multiple SMS messages.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || !name.trim() || !content.trim()}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingTemplate ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This template will be permanently deleted. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
