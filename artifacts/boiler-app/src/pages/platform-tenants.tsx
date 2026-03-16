import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, ChevronRight, Users, Plus } from "lucide-react";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-700",
};

export default function PlatformTenants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ company_name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["platform-tenants", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/platform/tenants?${params}`);
      if (!res.ok) throw new Error("Failed to load tenants");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof addForm) => {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create company");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Company created" });
      setShowAdd(false);
      setAddForm({ company_name: "", contact_name: "", contact_email: "", contact_phone: "" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage all subscribing companies</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-2" />Add Company
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["", "trial", "active", "suspended", "cancelled"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s || "All"}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-12 bg-slate-100 rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : !tenants || tenants.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No companies found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tenants.map((t: { id: string; company_name: string; contact_email: string; status: string; plan_name: string | null; user_count: number; created_at: string; trial_ends_at: string | null }) => (
            <Link key={t.id} href={`/platform/tenants/${t.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.contact_email}</p>
                  </div>
                  <Badge variant="secondary" className={STATUS_COLORS[t.status] || ""}>
                    {t.status}
                  </Badge>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{t.plan_name || "No plan"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {t.user_count} users
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Company</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={addForm.company_name} onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={addForm.contact_name} onChange={(e) => setAddForm({ ...addForm, contact_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <Input type="email" value={addForm.contact_email} onChange={(e) => setAddForm({ ...addForm, contact_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={addForm.contact_phone} onChange={(e) => setAddForm({ ...addForm, contact_phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(addForm)}
              disabled={!addForm.company_name || !addForm.contact_email || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
