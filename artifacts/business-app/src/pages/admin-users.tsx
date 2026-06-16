import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Users, ShieldCheck, Wrench, UserCog, Package, UserPlus, Copy, Trash2, Clock } from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useInitData } from "@/hooks/use-init-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type InviteCode = {
  id: string;
  code: string;
  role: string;
  expires_at: string | null;
  used_at: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "office_staff" | "technician";
  phone?: string | null;
  created_at: string;
  can_be_assigned_jobs: boolean;
};

type TenantAddon = {
  addon_id: string;
  addons: { id: string; name: string; feature_keys: string[]; monthly_price: number } | null;
};

type UserAddon = {
  user_id: string;
  addon_id: string;
  addons: { id: string; name: string } | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  office_staff: "Office Staff",
  technician: "Technician",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700 border-violet-200",
  office_staff: "bg-blue-100 text-blue-700 border-blue-200",
  technician: "bg-slate-100 text-slate-700 border-slate-200",
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="w-3.5 h-3.5" />,
  office_staff: <UserCog className="w-3.5 h-3.5" />,
  technician: <Wrench className="w-3.5 h-3.5" />,
};

function AdminUsersContent() {
  const { toast } = useToast();
  const { profile: me } = useAuth();
  const queryClient = useQueryClient();
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [pendingAssignable, setPendingAssignable] = useState<Record<string, boolean>>({});
  const [pendingAddons, setPendingAddons] = useState<Record<string, Set<string>>>({});
  const [savingAddons, setSavingAddons] = useState<Record<string, boolean>>({});
  const { data: initData } = useInitData();
  const usageLimits = initData?.usageLimits;

  // Invite state
  const [inviteRole, setInviteRole] = useState("technician");
  const [showInviteSection, setShowInviteSection] = useState(false);

  const { data: users, isLoading } = useQuery<Profile[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  const { data: inviteCodes } = useQuery<InviteCode[]>({
    queryKey: ["admin-invite-codes"],
    queryFn: () => fetch("/api/admin/invite-codes").then(r => r.json()),
  });

  const createInvite = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to create invite"); }
      return res.json() as Promise<InviteCode>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invite-codes"] });
      const link = `${window.location.origin}/register?code=${data.code}`;
      navigator.clipboard.writeText(link).catch(() => {});
      toast({ title: "Invite link created & copied!", description: `Expires in 7 days. Role: ${data.role}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-invite-codes"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Available per-seat addons this tenant has active
  const { data: availableAddons } = useQuery<TenantAddon[]>({
    queryKey: ["admin-available-addons"],
    queryFn: () => fetch("/api/admin/available-addons").then(r => r.json()),
  });

  // Current user-addon assignments
  const { data: userAddons } = useQuery<UserAddon[]>({
    queryKey: ["admin-user-addons"],
    queryFn: () => fetch("/api/admin/user-addons").then(r => r.json()),
  });

  // Build userId → Set<addonId> from server data
  const serverAddonMap: Record<string, Set<string>> = {};
  for (const ua of userAddons ?? []) {
    if (!serverAddonMap[ua.user_id]) serverAddonMap[ua.user_id] = new Set();
    serverAddonMap[ua.user_id].add(ua.addon_id);
  }

  const getEffectiveAddons = (userId: string): Set<string> =>
    pendingAddons[userId] ?? serverAddonMap[userId] ?? new Set();

  const hasAddonPendingChange = (userId: string): boolean => {
    if (!pendingAddons[userId]) return false;
    const server = serverAddonMap[userId] ?? new Set();
    const pending = pendingAddons[userId];
    if (pending.size !== server.size) return true;
    for (const id of pending) { if (!server.has(id)) return true; }
    return false;
  };

  const saveAddonsMutation = useMutation({
    mutationFn: async ({ userId, addonIds }: { userId: string; addonIds: string[] }) => {
      const res = await fetch(`/api/admin/users/${userId}/addons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon_ids: addonIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-addons"] });
      setPendingAddons(p => { const n = { ...p }; delete n[vars.userId]; return n; });
      toast({ title: "Addons updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    onSettled: (_, __, vars) => setSavingAddons(p => { const n = { ...p }; delete n[vars.userId]; return n; }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role, can_be_assigned_jobs }: { id: string; role: string; can_be_assigned_jobs?: boolean }) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, can_be_assigned_jobs }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assignable-users"] });
      setPendingRoles(p => { const n = { ...p }; delete n[vars.id]; return n; });
      setPendingAssignable(p => { const n = { ...p }; delete n[vars.id]; return n; });
      toast({ title: "Updated", description: "User updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/users/${id}`, { method: "DELETE" }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User removed", description: "Account has been deleted." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8">Loading users...</div>;

  const pendingInvites = (inviteCodes ?? []).filter(c => c.is_active && !c.used_at && (!c.expires_at || new Date(c.expires_at) > new Date()));

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage user accounts and roles</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            <Users className="w-4 h-4 mr-1.5" />
            {usageLimits
              ? `${usageLimits.currentUsers} of ${usageLimits.maxUsers} seats used`
              : `${users?.length ?? 0} ${users?.length === 1 ? "member" : "members"}`}
          </Badge>
          <Button size="sm" onClick={() => setShowInviteSection(v => !v)}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Invite Team Member
          </Button>
        </div>
      </div>

      {showInviteSection && (
        <Card className="p-5 border-0 shadow-sm bg-blue-50/60 space-y-4">
          <h2 className="font-semibold text-base">Invite a new team member</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-44 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="office_staff">Office Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground invisible">Action</label>
              <Button
                onClick={() => createInvite.mutate(inviteRole)}
                disabled={createInvite.isPending}
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Generate &amp; copy invite link
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The link expires in 7 days. Share it with your new team member — they'll register and be automatically added to your account.
          </p>

          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending invites</p>
              {pendingInvites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 bg-background rounded-lg px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground">{inv.code}</span>
                    <Badge variant="outline" className="text-xs capitalize">{inv.role.replace("_", " ")}</Badge>
                    {inv.expires_at && (
                      <span className="text-xs text-muted-foreground">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => {
                        const link = `${window.location.origin}/register?code=${inv.code}`;
                        navigator.clipboard.writeText(link).catch(() => {});
                        toast({ title: "Copied!", description: "Invite link copied to clipboard." });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => revokeInvite.mutate(inv.id)}
                      disabled={revokeInvite.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/70">
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Role</th>                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Assignable</th>                {availableAddons && availableAddons.length > 0 && (
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />Add-ons</span>
                  </th>
                )}
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Joined</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map(user => {
                const isMe = user.id === me?.id;
                const pendingRole = pendingRoles[user.id] ?? user.role;
                const pendingAssign = pendingAssignable[user.id] ?? user.can_be_assigned_jobs;
                const hasPendingChange = (pendingRoles[user.id] !== undefined && pendingRoles[user.id] !== user.role)
                  || (pendingAssignable[user.id] !== undefined && pendingAssignable[user.id] !== user.can_be_assigned_jobs);
                const effectiveAddonIds = getEffectiveAddons(user.id);
                const addonPendingChange = hasAddonPendingChange(user.id);
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                          {user.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.full_name}</p>
                          {isMe && <p className="text-xs text-muted-foreground">You</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{user.email}</td>
                    <td className="px-5 py-4">
                      <select
                        value={pendingRole}
                        onChange={e => setPendingRoles(p => ({ ...p, [user.id]: e.target.value }))}
                        disabled={isMe}
                        className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="admin">Admin</option>
                        <option value="office_staff">Office Staff</option>
                        <option value="technician">Technician</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pendingAssign}
                          onChange={e => setPendingAssignable(p => ({ ...p, [user.id]: e.target.checked }))}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">Can be assigned jobs</span>
                      </label>
                    </td>
                    {availableAddons && availableAddons.length > 0 && (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {availableAddons.map(ta => {
                            if (!ta.addons) return null;
                            const addonId = ta.addon_id;
                            const checked = effectiveAddonIds.has(addonId);
                            return (
                              <label key={addonId} className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    setPendingAddons(p => {
                                      const current = new Set(p[user.id] ?? serverAddonMap[user.id] ?? new Set<string>());
                                      if (e.target.checked) current.add(addonId);
                                      else current.delete(addonId);
                                      return { ...p, [user.id]: current };
                                    });
                                  }}
                                  className="w-4 h-4 rounded border-border accent-primary"
                                />
                                <span className="text-xs text-muted-foreground">{ta.addons.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {hasPendingChange && (
                          <Button
                            size="sm"
                            onClick={() => updateRole.mutate({ id: user.id, role: pendingRole, can_be_assigned_jobs: pendingAssign })}
                            disabled={updateRole.isPending}
                          >
                            Save
                          </Button>
                        )}
                        {addonPendingChange && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSavingAddons(p => ({ ...p, [user.id]: true }));
                              saveAddonsMutation.mutate({ userId: user.id, addonIds: [...effectiveAddonIds] });
                            }}
                            disabled={savingAddons[user.id]}
                          >
                            Save addons
                          </Button>
                        )}
                        {!isMe && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Remove ${user.full_name}? This cannot be undone.`)) {
                                deleteUser.mutate(user.id);
                              }
                            }}
                            disabled={deleteUser.isPending}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <span key={role} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}>
            {ROLE_ICON[role]} {label}
          </span>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">— Role definitions</span>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { hasFeature } = usePlanFeatures();

  if (!hasFeature("team_management")) {
    return <UpgradePrompt feature="team_management" />;
  }

  return <AdminUsersContent />;
}
