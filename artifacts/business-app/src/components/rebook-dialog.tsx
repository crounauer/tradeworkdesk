import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Clock, MapPin, User, Loader2, CalendarCheck, AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CalendarJob {
  id: string;
  customer_name?: string | null;
  property_address?: string | null;
  technician_name?: string | null;
  job_type: string;
  job_type_name?: string | null;
  status: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  scheduled_end_date?: string | null;
}

interface RebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  /** Original scheduled date as YYYY-MM-DD */
  originalDate: string;
  /** Original scheduled time as HH:MM, or null */
  originalTime?: string | null;
}

type LeaveConflict = {
  technician_id: string;
  technician_name: string | null;
  holiday_type: "technician_leave" | "technician_away" | "technician_sick";
  holiday_name: string;
  start_date: string;
  end_date: string;
};

function addOneYear(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date().toISOString().slice(0, 10);
  }
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function getWeekRange(dateStr: string): { from: string; to: string } {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(dateStr + "T00:00:00")
    : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + mondayOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    from: mon.toISOString().slice(0, 10),
    to: sun.toISOString().slice(0, 10),
  };
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m}${hour >= 12 ? "pm" : "am"}`;
}

function formatLeaveConflict(conflict: LeaveConflict): string {
  const typeLabel = conflict.holiday_type.replace("technician_", "").replace(/_/g, " ");
  const start = new Date(`${conflict.start_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const end = new Date(`${conflict.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${conflict.technician_name || "Assigned technician"} is unavailable for ${conflict.holiday_name} (${typeLabel}) from ${start} to ${end}.`;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  requires_follow_up: "bg-rose-100 text-rose-700",
  awaiting_parts: "bg-orange-100 text-orange-700",
  invoiced: "bg-violet-100 text-violet-700",
  cancelled: "bg-slate-200 text-slate-500",
};

export function RebookDialog({ open, onOpenChange, jobId, originalDate, originalTime }: RebookDialogProps) {
  const defaultDate = addOneYear(originalDate);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedTime, setSelectedTime] = useState(originalTime ? originalTime.slice(0, 5) : "");
  const [confirming, setConfirming] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [leaveConflict, setLeaveConflict] = useState<LeaveConflict | null>(null);
  // After rebook succeeds, hold the new job and show email prompt
  const [newJob, setNewJob] = useState<{ id: string; job_ref?: string | null } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  // Reset each time dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDate(addOneYear(originalDate));
      setSelectedTime(originalTime ? originalTime.slice(0, 5) : "");
      setNewJob(null);
      setLeaveConflict(null);
    }
  }, [open, originalDate, originalTime]);

  const { from, to } = getWeekRange(selectedDate);

  const { data: calendarData, isFetching } = useQuery({
    queryKey: ["/api/calendar", from, to],
    queryFn: () =>
      customFetch(
        `${import.meta.env.BASE_URL}api/calendar?date_from=${from}&date_to=${to}`
      ) as Promise<{ jobs: CalendarJob[] }>,
    enabled: open && !newJob && !!selectedDate,
    staleTime: 60_000,
  });

  const jobsOnDate = (calendarData?.jobs ?? []).filter((j) => {
    const jDate = String(j.scheduled_date).slice(0, 10);
    const jEnd = j.scheduled_end_date ? String(j.scheduled_end_date).slice(0, 10) : jDate;
    return jDate <= selectedDate && selectedDate <= jEnd;
  }).filter((j) => j.status !== "cancelled");

  const handleConfirm = async () => {
    setConfirming(true);
    setLeaveConflict(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${jobId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scheduled_date: selectedDate,
          ...(selectedTime ? { scheduled_time: selectedTime + ":00" } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string; conflict?: LeaveConflict };
        if (body.code === "TECHNICIAN_LEAVE_CONFLICT" && body.conflict) {
          setLeaveConflict(body.conflict);
          return;
        }
        throw new Error(body.error || "Failed to rebook job");
      }
      const created = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      // Move to email prompt step
      setNewJob(created);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to rebook job",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleSendEmail = async () => {
    if (!newJob) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/jobs/${newJob.id}/send-confirmation`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send confirmation");
      }
      toast({ title: "Confirmation sent", description: "Appointment confirmation emailed to customer." });
    } catch (err) {
      toast({
        title: "Email failed",
        description: err instanceof Error ? err.message : "Could not send confirmation email",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
      onOpenChange(false);
    }
  };

  const handleSkipEmail = () => {
    if (!newJob) return;
    toast({
      title: "Job rebooked",
      description: `${newJob.job_ref ?? "New job"} scheduled for ${formatDateDisplay(selectedDate)}`,
      action: (
        <button className="text-sm font-medium underline" onClick={() => navigate(`/jobs/${newJob.id}`)}>
          View
        </button>
      ),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            {newJob ? "Job Rebooked" : "Rebook Job"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 2: email confirmation prompt ── */}
        {newJob ? (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">
                    {newJob.job_ref ?? "New job"} booked for {formatDateDisplay(selectedDate)}
                    {selectedTime && ` at ${formatTime(selectedTime)}`}
                  </p>
                  <button
                    className="text-xs underline mt-0.5"
                    onClick={() => { onOpenChange(false); navigate(`/jobs/${newJob.id}`); }}
                  >
                    View job
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Send appointment confirmation?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This will email the customer with the new appointment date and time.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleSkipEmail} disabled={sendingEmail}>
                Skip
              </Button>
              <Button onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" /> Send Email</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* ── Step 1: date/time + availability ── */
          <>
            <div className="space-y-4">
              {leaveConflict && (
                <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="font-medium">Assigned technician is on leave</p>
                    <p className="mt-1 text-rose-800">{formatLeaveConflict(leaveConflict)}</p>
                  </div>
                </div>
              )}

              {/* Date + Time row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rebook-date">Scheduled Date</Label>
                  <input
                    id="rebook-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value || defaultDate)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rebook-time">Time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <input
                    id="rebook-time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Default is 1 year from original ({formatDateDisplay(defaultDate)})
              </p>

              {/* Availability for chosen date */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Schedule on {formatDateDisplay(selectedDate)}
                  </span>
                  {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>

                <div className="divide-y divide-border/50 max-h-52 overflow-y-auto">
                  {jobsOnDate.length === 0 ? (
                    <div className="px-3 py-4 flex items-center gap-2 text-sm text-emerald-700">
                      <CalendarCheck className="w-4 h-4" />
                      No other jobs booked — day is free
                    </div>
                  ) : (
                    <>
                      {jobsOnDate.length >= 3 && (
                        <div className="px-3 py-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          {jobsOnDate.length} job{jobsOnDate.length !== 1 ? "s" : ""} already booked this day
                        </div>
                      )}
                      {jobsOnDate.map((j) => (
                        <div key={j.id} className="px-3 py-2.5 text-sm">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[j.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {j.status.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {j.job_type_name ?? j.job_type.replace(/_/g, " ")}
                            </span>
                            {j.scheduled_time && (
                              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" /> {formatTime(j.scheduled_time)}
                              </span>
                            )}
                          </div>
                          {j.customer_name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3" /> {j.customer_name}
                              {j.property_address && (
                                <span className="flex items-center gap-1 ml-2">
                                  <MapPin className="w-3 h-3" /> {j.property_address}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={confirming || !selectedDate}>
                {confirming ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Booking...</>
                ) : (
                  <><CalendarCheck className="w-4 h-4 mr-2" /> Confirm Rebook</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
