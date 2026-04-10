import { useState, useMemo, useCallback, useRef, useEffect, DragEvent, MouseEvent } from "react";
import { useListJobs, useUpdateJob, useListProfiles } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Calendar, Plus, MessageSquarePlus, Clock, MapPin, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type CalendarJob = {
  id: string;
  customer_name?: string | null;
  property_address?: string | null;
  technician_name?: string | null;
  assigned_technician_id?: string | null;
  job_type: string;
  status: string;
  priority: string;
  scheduled_date: string | Date;
  scheduled_time?: string | null;
  scheduled_end_date?: string | null;
};

type ViewMode = "day" | "week" | "month";

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatMonthTitle(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function getJobEndDate(job: CalendarJob): string {
  if (job.scheduled_end_date) {
    return String(job.scheduled_end_date).slice(0, 10);
  }
  return String(job.scheduled_date).slice(0, 10);
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  requires_follow_up: "bg-rose-100 text-rose-700 border-rose-200",
  awaiting_parts: "bg-orange-100 text-orange-700 border-orange-200",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

function getWorkloadColor(count: number): string {
  if (count <= 2) return "bg-emerald-500";
  if (count <= 4) return "bg-amber-500";
  return "bg-red-500";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ScheduleCalendarProps {
  onDayAction?: (date: string, action: "enquiry" | "job") => void;
  prefetchedJobs?: CalendarJob[];
  prefetchedProfiles?: unknown[];
  prefetchedDateRange?: { date_from: string; date_to: string };
}

export default function ScheduleCalendar({ onDayAction, prefetchedJobs, prefetchedProfiles, prefetchedDateRange }: ScheduleCalendarProps = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateJob = useUpdateJob();

  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const didDragRef = useRef(false);
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverDate) return;
    const handler = (e: Event) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverDate(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverDate]);

  const canDrag =
    profile?.role === "admin" ||
    profile?.role === "office_staff" ||
    profile?.role === "super_admin";

  const days = useMemo(() => {
    if (viewMode === "day") {
      return [new Date(anchorDate)];
    } else if (viewMode === "week") {
      const start = startOfWeek(anchorDate);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      const monthStart = startOfMonth(anchorDate);
      const monthEnd = endOfMonth(anchorDate);
      const calStart = startOfWeek(monthStart);
      const totalDays = Math.ceil(
        (monthEnd.getTime() - calStart.getTime()) / 86400000
      ) + 1;
      const rows = Math.ceil(totalDays / 7) * 7;
      return Array.from({ length: rows }, (_, i) => addDays(calStart, i));
    }
  }, [viewMode, anchorDate]);

  const dateFrom = days[0];
  const dateTo = days[days.length - 1];

  const dateFromStr = toDateStr(dateFrom);
  const dateToStr = toDateStr(addDays(dateTo, 1));

  const isPrefetchHit = !!(
    prefetchedJobs &&
    prefetchedDateRange &&
    dateFromStr >= prefetchedDateRange.date_from &&
    toDateStr(dateTo) <= prefetchedDateRange.date_to
  );

  const { data: jobsResponse } = useListJobs({
    date_from: dateFromStr,
    date_to: dateToStr,
    limit: 500,
  } as Record<string, string>, { query: { enabled: !isPrefetchHit } });

  const calendarJobs = isPrefetchHit
    ? (prefetchedJobs ?? [])
    : (((jobsResponse as any)?.jobs ?? []) as CalendarJob[]);

  const { data: fetchedProfiles = [] } = useListProfiles({ query: { enabled: !prefetchedProfiles } });
  const profiles = (prefetchedProfiles ?? fetchedProfiles) as typeof fetchedProfiles;

  const technicians = useMemo(
    () => profiles.filter((p) => p.role === "technician"),
    [profiles]
  );

  const jobsByDate = useMemo(() => {
    const map: Record<string, CalendarJob[]> = {};
    for (const day of days) {
      map[toDateStr(day)] = [];
    }
    for (const job of calendarJobs) {
      const startStr = String(job.scheduled_date).slice(0, 10);
      const endStr = getJobEndDate(job);

      for (const day of days) {
        const ds = toDateStr(day);
        if (ds >= startStr && ds <= endStr) {
          if (map[ds]) map[ds].push(job);
        }
      }
    }
    for (const ds of Object.keys(map)) {
      map[ds].sort((a, b) => {
        const ta = a.scheduled_time || "99:99";
        const tb = b.scheduled_time || "99:99";
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [calendarJobs, days]);

  const techWorkload = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const day of days) {
      const ds = toDateStr(day);
      map[ds] = {};
    }
    for (const job of calendarJobs) {
      if (!job.assigned_technician_id) continue;
      const startStr = String(job.scheduled_date).slice(0, 10);
      const endStr = getJobEndDate(job);
      for (const day of days) {
        const ds = toDateStr(day);
        if (ds >= startStr && ds <= endStr && map[ds]) {
          map[ds][job.assigned_technician_id] =
            (map[ds][job.assigned_technician_id] || 0) + 1;
        }
      }
    }
    return map;
  }, [calendarJobs, days]);

  const todayStr = toDateStr(new Date());

  const navigateCalendar = useCallback(
    (dir: number) => {
      if (viewMode === "day") {
        setAnchorDate((prev) => addDays(prev, dir));
      } else if (viewMode === "week") {
        setAnchorDate((prev) => addDays(prev, dir * 7));
      } else {
        setAnchorDate((prev) => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() + dir);
          return d;
        });
      }
    },
    [viewMode]
  );

  const goToday = useCallback(() => {
    if (viewMode === "day") setAnchorDate(new Date());
    else if (viewMode === "month") setAnchorDate(startOfMonth(new Date()));
    else setAnchorDate(startOfWeek(new Date()));
  }, [viewMode]);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, jobId: string) => {
      if (!canDrag) return;
      didDragRef.current = true;
      e.dataTransfer.setData("text/plain", jobId);
      e.dataTransfer.effectAllowed = "move";
      setDragJobId(jobId);
    },
    [canDrag]
  );

  const handleJobClick = useCallback(
    (e: MouseEvent, jobId: string) => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      e.stopPropagation();
      navigate(`/jobs/${jobId}`);
    },
    [navigate]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, newDateStr: string) => {
      e.preventDefault();
      setDragOverDate(null);
      setDragJobId(null);
      if (!canDrag) return;

      const jobId = e.dataTransfer.getData("text/plain");
      if (!jobId) return;

      const job = calendarJobs.find((j) => j.id === jobId);
      if (!job) return;

      const oldDateStr = String(job.scheduled_date).slice(0, 10);
      if (oldDateStr === newDateStr) return;

      const updateData: Record<string, string> = {
        scheduled_date: newDateStr,
      };

      if (job.scheduled_end_date) {
        const oldStart = new Date(oldDateStr + "T00:00:00");
        const oldEnd = new Date(
          String(job.scheduled_end_date).slice(0, 10) + "T00:00:00"
        );
        const duration = Math.round(
          (oldEnd.getTime() - oldStart.getTime()) / 86400000
        );
        const newEnd = addDays(new Date(newDateStr + "T00:00:00"), duration);
        updateData.scheduled_end_date = toDateStr(newEnd);
      }

      try {
        await updateJob.mutateAsync({
          id: jobId,
          data: updateData as { scheduled_date: string },
        });
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
        toast({
          title: "Job rescheduled",
          description: `Moved to ${new Date(newDateStr + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
        });
      } catch {
        toast({
          title: "Failed to reschedule",
          description: "Could not update the job. Please try again.",
          variant: "destructive",
        });
      }
    },
    [canDrag, calendarJobs, updateJob, qc, toast]
  );

  const headerTitle =
    viewMode === "day"
      ? anchorDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : viewMode === "month"
        ? formatMonthTitle(anchorDate)
        : `${days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[days.length - 1].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const visibleTechs = useMemo(() => {
    if (profile?.role === "technician") {
      return technicians.filter((t) => t.id === profile.id);
    }
    return technicians;
  }, [technicians, profile]);

  return (
    <Card className="p-6 border-0 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <h2 className="text-xl font-display font-bold flex-1">Schedule</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode("day");
                setAnchorDate(new Date());
              }}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${viewMode === "day" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Day
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("week");
                setAnchorDate(startOfWeek(new Date()));
              }}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${viewMode === "week" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Week
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("month");
                setAnchorDate(startOfMonth(new Date()));
              }}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${viewMode === "month" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Month
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateCalendar(-1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              className="h-8 px-3 text-xs"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateCalendar(1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <span className="text-sm font-medium text-muted-foreground min-w-[160px] text-right hidden sm:block">
          {headerTitle}
        </span>
      </div>

      <div className="sm:hidden text-sm font-medium text-muted-foreground mb-3">
        {headerTitle}
      </div>

      {viewMode === "day" && (() => {
        const ds = toDateStr(anchorDate);
        const dayJobs = jobsByDate[ds] || [];
        const isToday = isSameDay(ds, todayStr);
        const jobsByHour: Record<number, CalendarJob[]> = {};
        const unscheduled: CalendarJob[] = [];
        let minHour = 7;
        let maxHour = 20;
        for (const job of dayJobs) {
          if (job.scheduled_time) {
            const hour = parseInt(job.scheduled_time.split(":")[0], 10);
            if (hour < minHour) minHour = hour;
            if (hour > maxHour) maxHour = hour;
            if (!jobsByHour[hour]) jobsByHour[hour] = [];
            jobsByHour[hour].push(job);
          } else {
            unscheduled.push(job);
          }
        }
        const HOURS = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);

        return (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className={`px-4 py-3 flex items-center justify-between ${isToday ? "bg-primary/5" : "bg-muted/50"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                  {anchorDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                {isToday && <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-medium">Today</span>}
              </div>
              <span className="text-sm text-muted-foreground font-medium">{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</span>
            </div>

            {onDayAction && (
              <div className="flex gap-2 px-4 py-2 border-b border-border bg-background">
                <button type="button" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors" onClick={() => onDayAction(ds, "enquiry")}>
                  <MessageSquarePlus className="w-3.5 h-3.5 text-orange-500" /> Add Enquiry
                </button>
                <button type="button" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors" onClick={() => onDayAction(ds, "job")}>
                  <Plus className="w-3.5 h-3.5 text-primary" /> Book Job
                </button>
              </div>
            )}

            <div className="bg-background">
              {HOURS.map((hour) => {
                const jobs = jobsByHour[hour] || [];
                const label = `${hour.toString().padStart(2, "0")}:00`;
                return (
                  <div key={hour} className="flex border-b border-border/50 last:border-b-0 min-h-[52px]">
                    <div className="w-16 shrink-0 px-2 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-r border-border/50 flex items-start justify-end pt-2">
                      {label}
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          data-job-card
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleJobClick(e, job.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                          className={`px-3 py-2 rounded-lg border transition-all cursor-pointer ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} hover:shadow-sm`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[job.priority] || "bg-slate-400"}`} />
                            <span className="text-sm font-semibold">{job.customer_name || "Unknown"}</span>
                            <span className="text-xs opacity-60 capitalize ml-auto">{job.job_type?.replace("_", " ")}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 ml-4">
                            {job.scheduled_time && (
                              <span className="flex items-center gap-1 text-xs opacity-75"><Clock className="w-3 h-3" />{formatTime(job.scheduled_time)}</span>
                            )}
                            {job.technician_name && (
                              <span className="flex items-center gap-1 text-xs opacity-75"><User className="w-3 h-3" />{job.technician_name}</span>
                            )}
                            {job.property_address && (
                              <span className="flex items-center gap-1 text-xs opacity-60 truncate max-w-[250px]"><MapPin className="w-3 h-3 shrink-0" />{job.property_address}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {unscheduled.length > 0 && (
                <div className="border-t-2 border-dashed border-border">
                  <div className="flex min-h-[52px]">
                    <div className="w-16 shrink-0 px-2 py-2 text-[10px] font-medium text-muted-foreground bg-muted/30 border-r border-border/50 flex items-start justify-end pt-2">
                      No time
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      {unscheduled.map((job) => (
                        <div
                          key={job.id}
                          data-job-card
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleJobClick(e, job.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                          className={`px-3 py-2 rounded-lg border transition-all cursor-pointer ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} hover:shadow-sm`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[job.priority] || "bg-slate-400"}`} />
                            <span className="text-sm font-semibold">{job.customer_name || "Unknown"}</span>
                            <span className="text-xs opacity-60 capitalize ml-auto">{job.job_type?.replace("_", " ")}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 ml-4">
                            {job.technician_name && (
                              <span className="flex items-center gap-1 text-xs opacity-75"><User className="w-3 h-3" />{job.technician_name}</span>
                            )}
                            {job.property_address && (
                              <span className="flex items-center gap-1 text-xs opacity-60 truncate max-w-[250px]"><MapPin className="w-3 h-3 shrink-0" />{job.property_address}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {visibleTechs.length > 0 && dayJobs.length > 0 && (
              <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-border bg-muted/30">
                {visibleTechs.map((tech) => {
                  const count = techWorkload[ds]?.[tech.id] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={tech.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center ${getWorkloadColor(count)}`}>
                        {getInitials(tech.full_name || "?")}
                      </span>
                      <span>{tech.full_name}: {count} job{count > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {viewMode !== "day" && <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="bg-muted px-2 py-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {days.map((day) => {
            const ds = toDateStr(day);
            const dayJobs = jobsByDate[ds] || [];
            const isToday = isSameDay(ds, todayStr);
            const isCurrentMonth =
              viewMode === "month" &&
              day.getMonth() === anchorDate.getMonth();
            const isDropTarget = dragOverDate === ds;
            const showPopover = popoverDate === ds;

            return (
              <div
                key={ds}
                className={`bg-background p-1.5 transition-all relative ${
                  viewMode === "month" ? "min-h-[100px]" : "min-h-[140px]"
                } ${isToday ? "ring-2 ring-inset ring-primary/30 bg-primary/[0.03]" : ""} ${
                  viewMode === "month" && !isCurrentMonth ? "opacity-40" : ""
                } ${isDropTarget ? "bg-primary/10 ring-2 ring-inset ring-primary/50" : ""} ${
                  onDayAction ? "cursor-pointer hover:bg-muted/30" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, ds)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, ds)}
                onClick={(e) => {
                  if (!onDayAction) return;
                  if ((e.target as HTMLElement).closest("[data-job-card]")) return;
                  e.stopPropagation();
                  setPopoverDate(showPopover ? null : ds);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setViewMode("day"); setAnchorDate(new Date(day)); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setViewMode("day"); setAnchorDate(new Date(day)); } }}
                    className={`text-xs font-medium cursor-pointer hover:underline ${
                      isToday
                        ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayJobs.length > 0 && (
                    <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                      {dayJobs.length}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 overflow-y-auto max-h-[110px]">
                  {dayJobs.slice(0, viewMode === "month" ? 3 : 6).map((job) => (
                    <div
                      key={job.id}
                      data-job-card
                      role="button"
                      tabIndex={0}
                      draggable={canDrag}
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      onDragEnd={() => { didDragRef.current = false; }}
                      onClick={(e) => handleJobClick(e, job.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                      className={`block text-[11px] leading-tight px-1.5 py-1 rounded border transition-all cursor-pointer ${
                        STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"
                      } ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${
                        dragJobId === job.id ? "opacity-50" : ""
                      } hover:shadow-sm`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            PRIORITY_DOT[job.priority] || "bg-slate-400"
                          }`}
                        />
                        <span className="font-medium truncate">
                          {job.customer_name || "Unknown"}
                        </span>
                        <span className="text-[10px] opacity-60 capitalize ml-auto shrink-0">
                          {job.job_type?.replace("_", " ")}
                        </span>
                      </div>
                      {job.scheduled_time && (
                        <div className="ml-2.5 text-[10px] opacity-75 truncate">
                          {formatTime(job.scheduled_time)}
                          {job.property_address && <span className="opacity-80"> · {job.property_address}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {dayJobs.length > (viewMode === "month" ? 3 : 6) && (
                    <span className="text-[10px] text-muted-foreground pl-1.5">
                      +{dayJobs.length - (viewMode === "month" ? 3 : 6)} more
                    </span>
                  )}
                </div>

                {visibleTechs.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1 pt-1 border-t border-border/50">
                    {visibleTechs.map((tech) => {
                      const count = techWorkload[ds]?.[tech.id] || 0;
                      if (count === 0) return null;
                      return (
                        <div
                          key={tech.id}
                          className="flex items-center gap-0.5"
                          title={`${tech.full_name}: ${count} job${count > 1 ? "s" : ""}`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center ${getWorkloadColor(count)}`}
                          >
                            {getInitials(tech.full_name || "?")}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showPopover && onDayAction && (
                  <div
                    ref={popoverRef}
                    className="absolute z-50 top-1 right-1 bg-background border border-border rounded-lg shadow-lg p-1.5 min-w-[140px] animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">
                      {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                      onClick={() => { setPopoverDate(null); onDayAction(ds, "enquiry"); }}
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-orange-500" />
                      Add Enquiry
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                      onClick={() => { setPopoverDate(null); onDayAction(ds, "job"); }}
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      Book Job
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>}

      {viewMode !== "day" && <div className="sm:hidden space-y-2">
        {days.map((day) => {
          const ds = toDateStr(day);
          const dayJobs = jobsByDate[ds] || [];
          const isToday = isSameDay(ds, todayStr);

          if (viewMode === "month" && dayJobs.length === 0) return null;

          return (
            <div
              key={ds}
              className={`rounded-lg border p-3 ${
                isToday
                  ? "border-primary/40 bg-primary/[0.03]"
                  : "border-border"
              }`}
              onDragOver={(e) => handleDragOver(e, ds)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, ds)}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    isToday ? "text-primary" : "text-foreground"
                  }`}
                >
                  {formatDayHeader(day)}
                  {isToday && (
                    <span className="ml-2 text-[10px] bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                      Today
                    </span>
                  )}
                </span>
                {dayJobs.length > 0 && (
                  <span className="text-xs font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {dayJobs.length} job{dayJobs.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {onDayAction && (
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                    onClick={() => onDayAction(ds, "enquiry")}
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-orange-500" />
                    Enquiry
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                    onClick={() => onDayAction(ds, "job")}
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    Book Job
                  </button>
                </div>
              )}

              {dayJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No jobs</p>
              ) : (
                <div className="space-y-1.5">
                  {dayJobs.map((job) => (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      draggable={canDrag}
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      onDragEnd={() => { didDragRef.current = false; }}
                      onClick={(e) => handleJobClick(e, job.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                      className={`block text-sm px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                        STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"
                      } ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            PRIORITY_DOT[job.priority] || "bg-slate-400"
                          }`}
                        />
                        <span className="font-medium">
                          {job.customer_name || "Unknown"}
                        </span>
                        <span className="text-xs opacity-75 capitalize ml-auto">
                          {job.job_type?.replace("_", " ")}
                        </span>
                      </div>
                      {job.property_address && (
                        <p className="text-xs opacity-60 mt-1 ml-4 truncate">
                          {job.property_address}
                        </p>
                      )}
                      {(job.scheduled_time || job.technician_name) && (
                        <div className="flex items-center gap-3 mt-1 ml-4 text-xs opacity-75">
                          {job.scheduled_time && (
                            <span>{formatTime(job.scheduled_time)}</span>
                          )}
                          {job.technician_name && (
                            <span>{job.technician_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {visibleTechs.length > 0 && dayJobs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
                  {visibleTechs.map((tech) => {
                    const count = techWorkload[ds]?.[tech.id] || 0;
                    if (count === 0) return null;
                    return (
                      <div
                        key={tech.id}
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <span
                          className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center ${getWorkloadColor(count)}`}
                        >
                          {getInitials(tech.full_name || "?")}
                        </span>
                        <span>
                          {tech.full_name?.split(" ")[0]}: {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {canDrag && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Drag and drop jobs between days to reschedule
        </p>
      )}
    </Card>
  );
}
