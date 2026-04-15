import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Package, CheckCircle2, CalendarPlus, XCircle, Clock,
  ArrowRight, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowUp {
  id: string;
  tenant_id: string;
  original_job_id: string;
  customer_id: string;
  property_id: string;
  work_description: string | null;
  parts_description: string | null;
  expected_parts_date: string | null;
  status: string;
  new_job_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  property_address: string | null;
  property_postcode: string | null;
  original_job_ref: string | null;
  original_job_status: string | null;
  original_job_type: string | null;
  creator_name: string | null;
}

interface FollowUpsResponse {
  follow_ups: FollowUp[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_TABS = [
  { value: "", label: "All", icon: Package },
  { value: "awaiting_parts", label: "Awaiting Parts", icon: Clock },
  { value: "parts_arrived", label: "Parts Arrived", icon: CheckCircle2 },
  { value: "booked", label: "Booked", icon: CalendarPlus },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
] as const;

const statusColors: Record<string, string> = {
  awaiting_parts: "bg-orange-100 text-orange-700",
  parts_arrived: "bg-emerald-100 text-emerald-700",
  booked: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(expectedDate: string | null, status: string): boolean {
  if (!expectedDate || status !== "awaiting_parts") return false;
  return new Date(expectedDate) < new Date(new Date().toISOString().split("T")[0]);
}

export default function FollowUps() {
  const [activeTab, setActiveTab] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const isAdmin = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";

  const { data, isLoading } = useQuery<FollowUpsResponse>({
    queryKey: ["follow-ups", activeTab, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab) params.set("status", activeTab);
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await fetch(`/api/follow-ups?${params}`);
      if (!res.ok) throw new Error("Failed to fetch follow-ups");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status?: string; notes?: string; parts_description?: string; expected_parts_date?: string }) => {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["homepage"] });
      qc.invalidateQueries({ queryKey: ["me-init"] });
      toast({ title: "Follow-up updated" });
      setEditingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const followUps = data?.follow_ups || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-foreground">Follow-Ups</h1>
          <p className="text-muted-foreground mt-1">Track jobs awaiting parts or needing return visits.</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-5 w-48 bg-muted rounded mb-2" />
              <div className="h-4 w-64 bg-muted rounded" />
            </Card>
          ))}
        </div>
      ) : followUps.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold text-muted-foreground">No follow-ups found</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {activeTab ? "No follow-ups with this status." : "Create follow-ups from completed or invoiced jobs."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {followUps.map((fu) => (
            <FollowUpCard
              key={fu.id}
              followUp={fu}
              isAdmin={isAdmin}
              onEdit={() => setEditingId(fu.id)}
              onBookJob={() => setBookingId(fu.id)}
              onStatusChange={(status) => updateMutation.mutate({ id: fu.id, status })}
              updating={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {followUps.length} of {pagination.total} follow-ups
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground flex items-center px-2">
              Page {page} of {pagination.totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {editingId && (
        <EditFollowUpDialog
          followUp={followUps.find(f => f.id === editingId)!}
          open={!!editingId}
          onOpenChange={(v) => { if (!v) setEditingId(null); }}
          onSave={(updates) => updateMutation.mutate({ id: editingId, ...updates })}
          saving={updateMutation.isPending}
        />
      )}

      {bookingId && (
        <BookJobDialog
          followUp={followUps.find(f => f.id === bookingId)!}
          open={!!bookingId}
          onOpenChange={(v) => { if (!v) setBookingId(null); }}
          onBooked={(jobId) => {
            setBookingId(null);
            qc.invalidateQueries({ queryKey: ["follow-ups"] });
            qc.invalidateQueries({ queryKey: ["homepage"] });
            qc.invalidateQueries({ queryKey: ["me-init"] });
            qc.invalidateQueries({ queryKey: ["/api/jobs"] });
            toast({ title: "Job booked", description: "Follow-up job has been created and scheduled." });
            navigate(`/jobs/${jobId}`);
          }}
        />
      )}
    </div>
  );
}

function FollowUpCard({
  followUp: fu,
  isAdmin,
  onEdit,
  onBookJob,
  onStatusChange,
  updating,
}: {
  followUp: FollowUp;
  isAdmin: boolean;
  onEdit: () => void;
  onBookJob: () => void;
  onStatusChange: (status: string) => void;
  updating: boolean;
}) {
  const overdue = isOverdue(fu.expected_parts_date, fu.status);

  return (
    <Card className={cn("p-4 border shadow-sm transition-colors", overdue && "border-orange-300 bg-orange-50/50")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/jobs/${fu.original_job_id}`} className="font-bold text-sm hover:underline text-primary flex items-center gap-1">
              {fu.original_job_ref || `Job #${fu.original_job_id.slice(0, 8)}`}
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase", statusColors[fu.status] || "bg-slate-100 text-slate-600")}>
              {fu.status.replace(/_/g, " ")}
            </span>
            {overdue && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-600">
                <AlertTriangle className="w-3.5 h-3.5" /> Overdue
              </span>
            )}
          </div>

          <p className="text-sm text-foreground">
            <span className="font-medium">{fu.customer_name}</span>
            {fu.property_address && <span className="text-muted-foreground"> — {fu.property_address}{fu.property_postcode ? `, ${fu.property_postcode}` : ""}</span>}
          </p>

          {fu.parts_description && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Parts:</span> {fu.parts_description}
            </p>
          )}

          {fu.work_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              <span className="font-medium">Work:</span> {fu.work_description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {fu.expected_parts_date && (
              <span className={cn(overdue && "text-orange-600 font-semibold")}>
                Expected: {formatDate(fu.expected_parts_date)}
              </span>
            )}
            <span>Created: {formatDate(fu.created_at)}</span>
            {fu.creator_name && <span>By: {fu.creator_name}</span>}
          </div>

          {fu.new_job_id && (
            <Link href={`/jobs/${fu.new_job_id}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
              <ArrowRight className="w-3 h-3" /> View follow-up job
            </Link>
          )}
        </div>

        {isAdmin && fu.status !== "cancelled" && fu.status !== "booked" && (
          <div className="flex gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={onBookJob} disabled={updating}>
              <Briefcase className="w-4 h-4" /> Book Job
            </Button>
            {fu.status === "awaiting_parts" && (
              <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => onStatusChange("parts_arrived")} disabled={updating}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Parts Arrived
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit} disabled={updating}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => onStatusChange("cancelled")} disabled={updating}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function BookJobDialog({
  followUp,
  open,
  onOpenChange,
  onBooked,
}: {
  followUp: FollowUp;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onBooked: (jobId: string) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [scheduledTime, setScheduledTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) {
      toast({ title: "Missing date", description: "Please select a date for the job.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/follow-ups/${followUp.id}/convert-to-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to book job");
      }
      const data = await res.json();
      onBooked(data.job_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to book job";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Book Follow-Up Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
            <p><span className="font-medium">Customer:</span> {followUp.customer_name}</p>
            <p><span className="font-medium">Property:</span> {followUp.property_address}{followUp.property_postcode ? `, ${followUp.property_postcode}` : ""}</p>
            {followUp.parts_description && <p><span className="font-medium">Parts:</span> {followUp.parts_description}</p>}
            {followUp.work_description && <p><span className="font-medium">Work:</span> {followUp.work_description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Scheduled Date *</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
              <Briefcase className="w-4 h-4" />
              {submitting ? "Booking..." : "Book Job"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditFollowUpDialog({
  followUp,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  followUp: FollowUp;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (updates: Record<string, string | undefined>) => void;
  saving: boolean;
}) {
  const [partsDesc, setPartsDesc] = useState(followUp.parts_description || "");
  const [expectedDate, setExpectedDate] = useState(followUp.expected_parts_date || "");
  const [notes, setNotes] = useState(followUp.notes || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Parts Description</Label>
            <Textarea value={partsDesc} onChange={(e) => setPartsDesc(e.target.value)} placeholder="What parts are needed?" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Parts Date</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={3} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => onSave({ parts_description: partsDesc, expected_parts_date: expectedDate, notes })}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
