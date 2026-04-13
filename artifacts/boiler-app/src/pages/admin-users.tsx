import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Users, ShieldCheck, Wrench, UserCog } from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useInitData } from "@/hooks/use-init-data";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "office_staff" | "technician";
  phone?: string | null;
  created_at: string;
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
  const { data: initData } = useInitData();
  const usageLimits = initData?.usageLimits;

  const { data: users, isLoading } = useQuery<Profile[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingRoles(p => { const n = { ...p }; delete n[vars.id]; return n; });
      toast({ title: "Role updated", description: "User role has been changed." });
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

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage user accounts and roles</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Users className="w-4 h-4 mr-1.5" />
          {usageLimits
            ? `${usageLimits.currentUsers} of ${usageLimits.maxUsers} seats used`
            : `${users?.length ?? 0} ${users?.length === 1 ? "member" : "members"}`}
        </Badge>
      </div>

      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/70">
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground">Joined</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map(user => {
                const isMe = user.id === me?.id;
                const pendingRole = pendingRoles[user.id] ?? user.role;
                const hasPendingChange = pendingRoles[user.id] !== undefined && pendingRoles[user.id] !== user.role;
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
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {hasPendingChange && (
                          <Button
                            size="sm"
                            onClick={() => updateRole.mutate({ id: user.id, role: pendingRole })}
                            disabled={updateRole.isPending}
                          >
                            Save
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
