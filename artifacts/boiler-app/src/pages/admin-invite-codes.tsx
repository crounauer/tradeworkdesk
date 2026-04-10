import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, X, CheckCircle2, Clock, Ban, Link } from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";

type InviteCode = {
  id: string;
  code: string;
  role: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
  is_active: boolean;
  note: string | null;
};

function codeStatus(code: InviteCode) {
  if (!code.is_active) return "revoked";
  if (code.used_at) return "used";
  if (code.expires_at && new Date(code.expires_at) < new Date()) return "expired";
  return "active";
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  used: "bg-slate-100 text-slate-500 border-slate-200",
  expired: "bg-amber-100 text-amber-700 border-amber-200",
  revoked: "bg-red-100 text-red-700 border-red-200",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  office_staff: "Office Staff",
  technician: "Technician",
};

function getRegisterUrl(code: string) {
  const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "");
  return `${base}/register?code=${code}`;
}

function AdminInviteCodesContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newRole, setNewRole] = useState("technician");
  const [newNote, setNewNote] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: codes, isLoading } = useQuery<InviteCode[]>({
    queryKey: ["invite-codes"],
    queryFn: () => fetch("/api/admin/invite-codes").then(r => r.json()),
  });

  const createCode = useMutation({
    mutationFn: () =>
      fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, note: newNote || null, expires_at: newExpiry || null }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-codes"] });
      setShowForm(false);
      setNewNote("");
      setNewExpiry("");
      setNewRole("technician");
      toast({ title: "Invite code created", description: "Share the link with the new team member." });
    },
    onError: (e: Error) => {
      const isMaxUsers = e.message?.includes("MAX_USERS_REACHED") || e.message?.toLowerCase().includes("maximum");
      toast({
        title: isMaxUsers ? "Team limit reached" : "Error",
        description: isMaxUsers
          ? "Your plan's maximum number of users has been reached. Upgrade your plan to add more team members."
          : e.message,
        variant: "destructive",
      });
    },
  });

  const revokeCode = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/invite-codes/${id}`, { method: "DELETE" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-codes"] });
      toast({ title: "Code revoked" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyLink = (code: InviteCode) => {
    navigator.clipboard.writeText(getRegisterUrl(code.code));
    setCopiedId(code.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied!", description: "Paste it and send to the new user." });
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const active = (codes ?? []).filter(c => codeStatus(c) === "active");
  const past = (codes ?? []).filter(c => codeStatus(c) !== "active");

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Invite Codes</h1>
          <p className="text-muted-foreground mt-1">Generate single-use links to invite new team members</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Invite
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="p-6 border border-primary/20 shadow-md">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg">Create Invite Link</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Role to assign</Label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="technician">Technician</option>
                <option value="office_staff">Office Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. For John Smith" value={newNote} onChange={e => setNewNote(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expires (optional)</Label>
              <Input type="datetime-local" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={() => createCode.mutate()} disabled={createCode.isPending}>
              {createCode.isPending ? "Creating…" : "Generate Invite Link"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Active codes */}
      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-3">
            {active.map(code => (
              <Card key={code.id} className="p-5 border-0 shadow-sm">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <span className="font-mono font-bold text-lg tracking-widest text-foreground">{code.code}</span>
                      <Badge className={`text-xs px-2 py-0.5 border font-medium ${STATUS_STYLES[codeStatus(code)]}`}>
                        {codeStatus(code)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{ROLE_LABELS[code.role] ?? code.role}</Badge>
                    </div>
                    {code.note && <p className="text-sm text-muted-foreground mb-1">{code.note}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Created {new Date(code.created_at).toLocaleDateString()}</span>
                      {code.expires_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expires {new Date(code.expires_at).toLocaleDateString()}</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">{getRegisterUrl(code.code)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => copyLink(code)} className="gap-1.5">
                      {copiedId === code.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copiedId === code.id ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => revokeCode.mutate(code.id)}
                      disabled={revokeCode.isPending}
                    >
                      <Ban className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && !showForm && (
        <Card className="p-12 text-center border-dashed border-2 shadow-none">
          <p className="text-muted-foreground mb-4">No active invite codes.</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Create your first invite link
          </Button>
        </Card>
      )}

      {/* Past codes */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Past</h2>
          <Card className="overflow-x-auto border-0 shadow-sm">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-slate-50/70">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Code</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Used / Revoked</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {past.map(code => (
                  <tr key={code.id} className="opacity-70">
                    <td className="px-5 py-3 font-mono font-semibold tracking-widest">{code.code}</td>
                    <td className="px-5 py-3">{ROLE_LABELS[code.role] ?? code.role}</td>
                    <td className="px-5 py-3">
                      <Badge className={`text-xs px-2 py-0.5 border font-medium ${STATUS_STYLES[codeStatus(code)]}`}>
                        {codeStatus(code)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {code.used_at ? new Date(code.used_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{code.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminInviteCodes() {
  const { hasFeature } = usePlanFeatures();

  if (!hasFeature("team_management")) {
    return <UpgradePrompt feature="team_management" />;
  }

  return <AdminInviteCodesContent />;
}
