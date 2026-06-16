import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket,
  Plus,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Check,
  Clock,
  Users,
  AlertCircle,
} from "lucide-react";

interface BetaInvite {
  id: string;
  code: string;
  email: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export default function PlatformBetaInvites() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: invites = [], isLoading } = useQuery<BetaInvite[]>({
    queryKey: ["beta-invites"],
    queryFn: async () => {
      const res = await fetch("/api/platform/beta-invites");
      if (!res.ok) throw new Error("Failed to load beta invites");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/beta-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          max_uses: maxUses,
          email: email || undefined,
          notes: notes || undefined,
          expires_at: expiresAt || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invites");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["beta-invites"] });
      toast({ title: `Created ${data.length} beta invite${data.length > 1 ? "s" : ""}` });
      setShowCreate(false);
      setCount(1);
      setMaxUses(1);
      setEmail("");
      setNotes("");
      setExpiresAt("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/platform/beta-invites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beta-invites"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/platform/beta-invites/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beta-invites"] });
      toast({ title: "Invite deleted" });
    },
  });

  const copyLink = (code: string, id: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/register?beta=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    toast({ title: "Invite link copied" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast({ title: "Code copied" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCount = invites.filter((i) => i.is_active && i.used_count < i.max_uses).length;
  const totalUsed = invites.reduce((sum, i) => sum + i.used_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Beta Invites</h1>
          <p className="text-muted-foreground">
            Manage beta access codes for new registrations
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invites
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Ticket className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Codes</p>
                <p className="text-2xl font-bold">{invites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Codes</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Registrations</p>
                <p className="text-2xl font-bold">{totalUsed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generate Beta Invite Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of codes</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max uses per code</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Lock to email (optional)</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If set, only this email can use the code
                </p>
              </div>
              <div className="space-y-2">
                <Label>Expiry date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="e.g. Batch for plumber conference"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Generate {count} Code{count > 1 ? "s" : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No beta invite codes yet</p>
              <p className="text-sm">Click "Create Invites" to generate codes</p>
            </div>
          ) : (
            <div className="divide-y">
              {invites.map((invite) => {
                const isExpired =
                  invite.expires_at && new Date(invite.expires_at) < new Date();
                const isExhausted = invite.used_count >= invite.max_uses;
                const isUsable = invite.is_active && !isExpired && !isExhausted;

                return (
                  <div
                    key={invite.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-bold bg-slate-100 px-2 py-1 rounded">
                          {invite.code}
                        </code>
                        {!invite.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Disabled
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                            Expired
                          </span>
                        )}
                        {isExhausted && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            Fully used
                          </span>
                        )}
                        {isUsable && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {invite.used_count}/{invite.max_uses} used
                        </span>
                        {invite.email && (
                          <span className="flex items-center gap-1">
                            Locked to: {invite.email}
                          </span>
                        )}
                        {invite.expires_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires:{" "}
                            {new Date(invite.expires_at).toLocaleDateString()}
                          </span>
                        )}
                        {invite.notes && (
                          <span className="italic">{invite.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(invite.code, invite.id)}
                        title="Copy code"
                      >
                        {copiedId === invite.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(invite.code, invite.id + "-link")}
                        title="Copy invite link"
                      >
                        <Ticket className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: invite.id,
                            is_active: !invite.is_active,
                          })
                        }
                        title={invite.is_active ? "Disable" : "Enable"}
                      >
                        {invite.is_active ? (
                          <ToggleRight className="w-4 h-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this invite code?")) {
                            deleteMutation.mutate(invite.id);
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Beta Registration Mode</p>
              <p className="mt-1">
                Registration is currently restricted to users with a valid beta
                invite code. New users must enter a code during sign-up to create
                an account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
