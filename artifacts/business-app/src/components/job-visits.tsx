import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Visit = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  all_day: boolean;
  estimated_duration: number | null;
  assigned_technician_id: string | null;
  notes: string | null;
};

type JobSchedule = {
  id: string; status: string; scheduled_date: string; scheduled_time?: string | null;
  scheduled_end_date?: string | null; estimated_duration?: number | null;
  assigned_technician_id?: string | null; all_day?: boolean | null;
};

type VisitForm = {
  date: string; time: string; duration: string; allDay: boolean; technician: string; notes: string;
};

export function JobVisits({ job, canManage }: { job: JobSchedule; canManage: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Visit | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VisitForm>({ date: "", time: "09:00", duration: "60", allDay: false, technician: "", notes: "" });
  const visitsKey = ["/api/jobs", job.id, "visits"];
  const { data: visits = [], isPending, error, refetch } = useQuery<Visit[]>({
    queryKey: visitsKey,
    queryFn: () => customFetch(`/api/jobs/${job.id}/visits`),
  });
  const { data: technicians = [], isPending: loadingStaff, error: staffError, refetch: refetchStaff } = useQuery<Array<{ id: string; full_name: string }>>({
    queryKey: ["/api/admin/assignable-users"],
    queryFn: () => customFetch("/api/admin/assignable-users"),
  });
  const canSchedule = canManage && !["completed", "cancelled", "invoiced"].includes(job.status);
  const technicianName = (id: string | null | undefined) => id
    ? technicians.find(t => t.id === id)?.full_name || "Assigned technician" : "Unassigned";
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: visitsKey }),
      qc.invalidateQueries({ queryKey: ["/api/calendar"] }),
      qc.invalidateQueries({ queryKey: ["homepage"] }),
    ]);
  };
  const edit = (visit?: Visit) => {
    setForm(visit ? {
      date: visit.scheduled_date, time: visit.scheduled_time?.slice(0, 5) || "09:00",
      duration: String(visit.estimated_duration || 60), allDay: visit.all_day,
      technician: visit.assigned_technician_id || "", notes: visit.notes || "",
    } : {
      date: "", time: job.scheduled_time?.slice(0, 5) || "09:00",
      duration: String(job.estimated_duration || 60), allDay: job.all_day === true || !job.scheduled_time,
      technician: job.assigned_technician_id || "", notes: "",
    });
    setEditing(visit?.id || "new");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await customFetch(`/api/jobs/${job.id}/visits${editing === "new" ? "" : `/${editing}`}`, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: form.date, scheduled_time: form.allDay ? null : form.time,
          estimated_duration: form.allDay ? null : Number(form.duration), all_day: form.allDay,
          assigned_technician_id: form.technician || null, notes: form.notes.trim() || null,
        }),
      });
      await refresh();
      setEditing(null);
      toast({ title: "Visit saved", description: "This date is scheduled under the same job." });
    } catch (err) {
      toast({ title: "Unable to save visit", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await customFetch(`/api/jobs/${job.id}/visits/${deleting.id}`, { method: "DELETE" });
      await refresh();
      setDeleting(null);
      toast({ title: "Visit removed" });
    } catch (err) {
      toast({ title: "Unable to remove visit", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return (
    <Card className="p-4 md:p-6 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-lg">Scheduled Visits</h3>
        {canSchedule && !editing && <Button type="button" size="sm" disabled={isPending || Boolean(error)} onClick={() => edit()}>Add Visit</Button>}
      </div>
      <p className="text-sm text-muted-foreground">Book separate dates for this job without creating a return job. Only the listed dates are reserved. Notes, documents and billing stay on this job.</p>
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-medium">Primary visit: {formatDate(job.scheduled_date)}{job.scheduled_end_date ? ` to ${formatDate(job.scheduled_end_date)}` : ""}</p>
        <p>{job.all_day || !job.scheduled_time ? "All day" : `${job.scheduled_time.slice(0, 5)}${job.estimated_duration ? ` (${job.estimated_duration} min)` : ""}`} · {technicianName(job.assigned_technician_id)}</p>
        <p className="text-xs text-muted-foreground">Use Edit Job to change the primary visit.</p>
      </div>
      {isPending && <p className="text-sm">Loading visits...</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error.message} <button className="underline" onClick={() => refetch()}>Retry</button></p>}
      {visits.map(visit => (
        <div key={visit.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <p className="font-medium">{formatDate(visit.scheduled_date)}</p>
            <p>{visit.all_day ? "All day" : `${visit.scheduled_time?.slice(0, 5)} (${visit.estimated_duration} min)`} · {technicianName(visit.assigned_technician_id)}</p>
            {visit.notes && <p className="text-muted-foreground whitespace-pre-wrap">{visit.notes}</p>}
          </div>
          {canManage && <div className="flex gap-2">
            {canSchedule && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => edit(visit)}>Edit visit</Button>}
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setDeleting(visit)}>Remove visit</Button>
          </div>}
        </div>
      ))}
      {!isPending && !error && visits.length === 0 && <p className="text-sm text-muted-foreground">No additional visits scheduled.</p>}
      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-lg border p-3">
          <h4 className="font-medium">{editing === "new" ? "Add Visit" : "Edit Visit"}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="visit-date">Visit date</Label><Input id="visit-date" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label htmlFor="visit-technician">Technician</Label>
              <select id="visit-technician" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" value={form.technician} disabled={loadingStaff || Boolean(staffError)} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}>
                <option value="">Unassigned</option>
                {form.technician && !technicians.some(t => t.id === form.technician) && <option value={form.technician}>Current technician</option>}
                {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            {!form.allDay && <>
              <div className="space-y-1"><Label htmlFor="visit-time">Start time</Label><Input id="visit-time" type="time" required value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="visit-duration">Duration (minutes)</Label><Input id="visit-duration" type="number" min="1" max="1440" step="1" required value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
            </>}
          </div>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} />All day</label>
          <div className="space-y-1"><Label htmlFor="visit-notes">Visit notes</Label><textarea id="visit-notes" className="w-full rounded-lg border bg-background p-2 text-sm" maxLength={4000} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          {staffError && <p role="alert" className="text-sm text-destructive">{staffError.message} <button type="button" className="underline" onClick={() => refetchStaff()}>Retry</button></p>}
          <p className="text-xs text-muted-foreground">Adding or editing a visit does not send a customer confirmation email. Use Email Customer to share these dates.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || loadingStaff || Boolean(staffError)}>{saving ? "Saving..." : "Save Visit"}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
      <AlertDialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !saving) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove this visit?</AlertDialogTitle><AlertDialogDescription>This removes only the additional scheduled date. The job and other visits will be kept.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={e => { e.preventDefault(); void remove(); }}>{saving ? "Removing..." : "Remove visit"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
