/**
 * Email Marketing Campaigns — create, schedule, and track bulk email campaigns
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Loader2, Plus, Trash2, Send, Eye, MailOpen, ChevronRight,
  Users, BarChart2,
} from "lucide-react";
import { format } from "date-fns";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  recipient_count: number;
  open_count: number;
  click_count: number;
  created_at: string;
  html_body?: string | null;
  text_body?: string | null;
  preview_text?: string | null;
  recipient_filter?: Record<string, unknown>;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  cancelled: "destructive",
  failed: "destructive",
};

const EMPTY_CAMPAIGN: Partial<Campaign> = {
  name: "",
  subject: "",
  preview_text: "",
  html_body: "",
  text_body: "",
  recipient_filter: {},
};

export default function EmailCampaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Campaign>>(EMPTY_CAMPAIGN);
  const [sendOpen, setSendOpen] = useState<Campaign | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [previewEmail, setPreviewEmail] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => apiFetch("/api/campaigns"),
  });

  const { data: selectedCampaign } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", selectedId],
    queryFn: () => apiFetch(`/api/campaigns/${selectedId}`),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (c: Partial<Campaign>) => apiFetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    }),
    onSuccess: (data: Campaign) => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setCreateOpen(false);
      setDraft(EMPTY_CAMPAIGN);
      setSelectedId(data.id);
      toast({ title: "Campaign created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (c: Partial<Campaign> & { id: string }) =>
      apiFetch(`/api/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      qc.invalidateQueries({ queryKey: ["/api/campaigns", selectedId] });
      toast({ title: "Campaign saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setSelectedId(null);
      toast({ title: "Campaign deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, scheduled_for }: { id: string; scheduled_for?: string }) =>
      apiFetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduled_for ? { scheduled_for } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      qc.invalidateQueries({ queryKey: ["/api/campaigns", selectedId] });
      setSendOpen(null);
      setScheduledFor("");
      toast({ title: "Campaign queued for sending" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const previewMutation = useMutation({
    mutationFn: ({ id, to_email }: { id: string; to_email: string }) =>
      apiFetch(`/api/campaigns/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email }),
      }),
    onSuccess: () => {
      setPreviewOpen(false);
      setPreviewEmail("");
      toast({ title: "Test email queued" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const selected = selectedCampaign;
  const isEditable = selected && (selected.status === "draft" || selected.status === "scheduled");

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MailOpen className="w-5 h-5 text-blue-600" />
          <h1 className="text-2xl font-bold">Email Campaigns</h1>
        </div>
        <Button size="sm" onClick={() => { setDraft(EMPTY_CAMPAIGN); setCreateOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Campaign list */}
        <div className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No campaigns yet.</p>
          ) : (
            campaigns.map((c) => (
              <Card key={c.id}
                className={`cursor-pointer transition-colors ${selectedId === c.id ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}
                onClick={() => setSelectedId(c.id)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant={STATUS_BADGE[c.status] ?? "secondary"} className="text-[10px]">{c.status}</Badge>
                    {c.status === "sent" && (
                      <span className="text-[10px] text-muted-foreground">{c.recipient_count} sent</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Campaign detail */}
        <div className="md:col-span-2">
          {!selected ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select a campaign or create a new one.
            </CardContent></Card>
          ) : (
            <Tabs defaultValue="content">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-lg">{selected.name}</h2>
                  <Badge variant={STATUS_BADGE[selected.status] ?? "secondary"}>{selected.status}</Badge>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {isEditable && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Test
                      </Button>
                      <Button size="sm" onClick={() => setSendOpen(selected)}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Send
                      </Button>
                    </>
                  )}
                  {selected.status === "draft" && (
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => { if (confirm("Delete this campaign?")) deleteMutation.mutate(selected.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="audience">Audience</TabsTrigger>
                {selected.status === "sent" && <TabsTrigger value="stats">Stats</TabsTrigger>}
              </TabsList>

              <TabsContent value="content" className="space-y-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Campaign Name (internal)</Label>
                  <Input defaultValue={selected.name} disabled={!isEditable}
                    onBlur={(e) => isEditable && e.target.value !== selected.name &&
                      updateMutation.mutate({ id: selected.id, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subject Line</Label>
                  <Input defaultValue={selected.subject} disabled={!isEditable}
                    onBlur={(e) => isEditable && e.target.value !== selected.subject &&
                      updateMutation.mutate({ id: selected.id, subject: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preview Text</Label>
                  <Input defaultValue={selected.preview_text ?? ""} disabled={!isEditable}
                    placeholder="Short preview shown below subject line…"
                    onBlur={(e) => isEditable &&
                      updateMutation.mutate({ id: selected.id, preview_text: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email Body (HTML or plain text)</Label>
                  <Textarea defaultValue={selected.html_body ?? ""} disabled={!isEditable}
                    rows={10} className="font-mono text-xs"
                    onBlur={(e) => isEditable &&
                      updateMutation.mutate({ id: selected.id, html_body: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Variables: <code>{"{{name}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{unsubscribe_link}}"}</code>
                </p>
              </TabsContent>

              <TabsContent value="audience" className="space-y-3 mt-3">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Recipient Filter</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      All customers with an email address are included by default. Unsubscribed addresses are always excluded.
                    </p>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {selected.recipient_count > 0 ? `${selected.recipient_count} recipients` : "Audience calculated at send time"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {selected.status === "sent" && (
                <TabsContent value="stats" className="mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Delivered", value: selected.recipient_count, icon: Send },
                      { label: "Opened", value: selected.open_count, icon: MailOpen },
                      { label: "Clicked", value: selected.click_count, icon: BarChart2 },
                      {
                        label: "Open Rate",
                        value: selected.recipient_count > 0
                          ? `${Math.round((selected.open_count / selected.recipient_count) * 100)}%`
                          : "—",
                        icon: BarChart2,
                      },
                    ].map(({ label, value, icon: Icon }) => (
                      <Card key={label}><CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Icon className="w-4 h-4" />
                          <span className="text-xs">{label}</span>
                        </div>
                        <p className="text-2xl font-bold">{value}</p>
                      </CardContent></Card>
                    ))}
                  </div>
                  {selected.sent_at && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Sent {format(new Date(selected.sent_at), "d MMM yyyy HH:mm")}
                    </p>
                  )}
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Campaign Name (internal)</Label>
              <Input value={draft.name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Summer Service Reminder 2026" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Subject Line</Label>
              <Input value={draft.subject ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => createMutation.mutate(draft)}
              disabled={!draft.name || !draft.subject || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={!!sendOpen} onOpenChange={() => setSendOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Leave the schedule blank to send immediately, or pick a date/time to schedule it.
            </p>
            <div className="space-y-1">
              <Label>Schedule for (optional)</Label>
              <Input type="datetime-local" value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => sendMutation.mutate({
              id: sendOpen!.id,
              scheduled_for: scheduledFor || undefined,
            })} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {scheduledFor ? "Schedule" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test email dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Test Email</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Send test to</Label>
              <Input type="email" value={previewEmail}
                onChange={(e) => setPreviewEmail(e.target.value)}
                placeholder="you@example.com" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => previewMutation.mutate({ id: selectedId!, to_email: previewEmail })}
              disabled={!previewEmail || previewMutation.isPending}>
              {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
