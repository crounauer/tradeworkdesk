import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Loader2, Users, Filter, CheckCircle2 } from "lucide-react";

interface AssignableUser {
  id: string;
  full_name: string;
  role: string;
  can_be_assigned_jobs: boolean;
}

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "requires_follow_up", label: "Requires Follow-up" },
];

export default function AdminReassignJobs() {
  const { toast } = useToast();
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["scheduled", "in_progress", "requires_follow_up"]);
  const [lastResult, setLastResult] = useState<{ count: number } | null>(null);

  const { data: users = [], isLoading: usersLoading, isError: usersError } = useQuery<AssignableUser[]>({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/assignable-users");
      if (!res.ok) throw new Error("Failed to load assignable users");
      return res.json();
    },
    retry: 2,
  });

  const { data: allUsers = [], isLoading: allUsersLoading, isError: allUsersError } = useQuery<AssignableUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    retry: 2,
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/jobs/bulk-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user_id: fromUserId || undefined,
          to_user_id: toUserId,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reassignment failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLastResult({ count: data.reassigned_count });
      if (data.reassigned_count > 0) {
        toast({ title: "Jobs reassigned", description: `${data.reassigned_count} job${data.reassigned_count !== 1 ? "s" : ""} reassigned successfully.` });
      } else {
        toast({ title: "No jobs matched", description: "No jobs matched the selected filters." });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const fromOptions = [
    { value: "unassigned", label: "Unassigned Jobs" },
    ...allUsers.map(u => ({ value: u.id, label: `${u.full_name} (${u.role})` })),
  ];

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Reassign Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Bulk reassign jobs from one technician to another, or assign unassigned jobs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Reassignment
          </CardTitle>
          <CardDescription>
            Select which jobs to move and who to assign them to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(usersError || allUsersError) && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              Failed to load user data. Please refresh the page to try again.
            </div>
          )}

          {(usersLoading || allUsersLoading) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading users...
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <select
                value={fromUserId}
                onChange={e => setFromUserId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">All users (including unassigned)</option>
                {fromOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>To *</Label>
              <select
                value={toUserId}
                onChange={e => setToUserId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                required
              >
                <option value="">Select technician...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRight className="w-4 h-4" />
            <span className="text-sm">
              {fromUserId === "unassigned"
                ? "Unassigned jobs"
                : fromUserId
                  ? `Jobs from ${allUsers.find(u => u.id === fromUserId)?.full_name || "selected user"}`
                  : "All matching jobs"}
              {" will be reassigned to "}
              {toUserId ? users.find(u => u.id === toUserId)?.full_name || "selected user" : "..."}
            </span>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Job Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleStatus(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedStatuses.includes(s.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={() => reassignMutation.mutate()}
              disabled={!toUserId || reassignMutation.isPending}
            >
              {reassignMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reassigning...</>
                : "Reassign Jobs"}
            </Button>

            {lastResult && (
              <Badge variant="outline" className="gap-1.5 text-green-700 border-green-200 bg-green-50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lastResult.count} job{lastResult.count !== 1 ? "s" : ""} reassigned
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
