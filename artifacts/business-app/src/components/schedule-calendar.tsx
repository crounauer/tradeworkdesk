import { useState, useMemo, useCallback, useRef, useEffect, DragEvent, MouseEvent } from "react";
import { useUpdateJob } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Calendar, Plus, MessageSquarePlus, Clock, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCalendarData } from "@/hooks/use-calendar-data";
import { AppointmentConfirmationBadge } from "@/components/appointment-confirmation-badge";

type CalendarJob = {
  id: string;
  customer_name?: string | null;
  property_address?: string | null;
  technician_name?: string | null;
  assigned_technician_id?: string | null;
  job_type: string;
  job_type_name?: string | null;
  visit_intent?: "standard" | "estimate" | null;
  status: string;
  priority: string;
  customer_confirmation_status?: "pending" | "confirmed" | "change_requested" | null;
  customer_confirmed_at?: string | null;
  customer_change_requested_at?: string | null;
  scheduled_date: string | Date;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  all_day?: boolean | null;
  scheduled_end_date?: string | null;
  description?: string | null;
};

type CalendarHoliday = {
  id: string;
  tenant_id: string;
  technician_id: string | null;
  technician_name?: string | null;
  name: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  holiday_type: "technician_leave" | "technician_away" | "technician_sick" | "public_holiday" | "bank_holiday";
  notes?: string | null;
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

function isTimedSingleDayHoliday(holiday: CalendarHoliday, dateStr: string): boolean {
  return Boolean(
    holiday.start_time
    && holiday.end_time
    && String(holiday.start_date).slice(0, 10) === dateStr
    && String(holiday.end_date).slice(0, 10) === dateStr,
  );
}

function holidayTimeRangeLabel(holiday: CalendarHoliday): string {
  if (!holiday.start_time || !holiday.end_time) return "All day";
  return `${formatTime(holiday.start_time)}-${formatTime(holiday.end_time)}`;
}

function parseHourMinute(value: string): { hour: number; minute: number } | null {
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

const BUSINESS_DAY_START_MINUTES = 9 * 60;
const BUSINESS_DAY_END_MINUTES = 17 * 60;
const BUSINESS_DAY_DURATION_MINUTES = BUSINESS_DAY_END_MINUTES - BUSINESS_DAY_START_MINUTES;

function durationLabel(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getJobDurationMinutes(job: CalendarJob): number {
  if (job.all_day === true || job.estimated_duration == null) return BUSINESS_DAY_DURATION_MINUTES;
  const parsed = Number(job.estimated_duration ?? 60);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return parsed;
}

function formatTimeFromMinutes(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, (24 * 60) - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return formatTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

function getJobTimeRangeLabel(job: CalendarJob): string {
  if (isAllDayJob(job)) return "All day";
  if (!job.scheduled_time) return "No time";
  const start = parseHourMinute(job.scheduled_time);
  const startLabel = formatTime(job.scheduled_time);
  if (!start) return startLabel;

  const duration = getJobDurationMinutes(job);
  const startMinutes = (start.hour * 60) + start.minute;
  const endMinutes = startMinutes + duration;
  if (!Number.isFinite(endMinutes) || endMinutes <= startMinutes) return startLabel;

  return `${startLabel}-${formatTimeFromMinutes(endMinutes)}`;
}

function getHolidayDurationMinutes(holiday: CalendarHoliday): number {
  if (!holiday.start_time || !holiday.end_time) return 60;
  const start = parseHourMinute(holiday.start_time);
  const end = parseHourMinute(holiday.end_time);
  if (!start || !end) return 60;
  const startMinutes = (start.hour * 60) + start.minute;
  const endMinutes = (end.hour * 60) + end.minute;
  if (endMinutes <= startMinutes) return 60;
  return endMinutes - startMinutes;
}

type DaySlotMinutes = 5 | 15 | 30;
const DEFAULT_DAY_SLOT_MINUTES: DaySlotMinutes = 15;
const DAY_SLOT_STORAGE_KEY = "schedule.daySlotMinutes";
const VIEW_MODE_STORAGE_KEY = "schedule.viewMode";

function formatTime24FromMinutes(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, (24 * 60) - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getSlotRangeLabel(startMinutes: number, slotMinutes = DEFAULT_DAY_SLOT_MINUTES): string {
  const endMinutes = startMinutes + slotMinutes;
  return `${formatTimeFromMinutes(startMinutes)}-${formatTimeFromMinutes(endMinutes)}`;
}

function getSlotStartsForDuration(startTime: string, durationMinutes: number, slotMinutes = DEFAULT_DAY_SLOT_MINUTES): number[] {
  const parsedStart = parseHourMinute(startTime);
  if (!parsedStart) return [];

  const startMinutes = (parsedStart.hour * 60) + parsedStart.minute;
  const slotAlignedStart = Math.floor(startMinutes / slotMinutes) * slotMinutes;
  const offset = startMinutes - slotAlignedStart;
  const slotCount = Math.max(1, Math.ceil((offset + durationMinutes) / slotMinutes));

  return Array.from({ length: slotCount }, (_, idx) => slotAlignedStart + (idx * slotMinutes))
    .filter((m) => m >= 0 && m <= ((24 * 60) - slotMinutes));
}

function getAllDaySlotStarts(slotMinutes = DEFAULT_DAY_SLOT_MINUTES): number[] {
  if (slotMinutes <= 0) return [BUSINESS_DAY_START_MINUTES];
  const start = BUSINESS_DAY_START_MINUTES;
  const end = BUSINESS_DAY_END_MINUTES;
  const totalSlots = Math.max(1, Math.floor((end - start) / slotMinutes));
  return Array.from({ length: totalSlots }, (_, idx) => start + (idx * slotMinutes));
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
  invoiced: "bg-violet-100 text-violet-700 border-violet-200",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  requires_follow_up: "Follow Up",
  awaiting_parts: "Awaiting Parts",
  invoiced: "Invoiced",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const HOLIDAY_STYLES: Record<CalendarHoliday["holiday_type"], string> = {
  technician_leave: "bg-rose-100 text-rose-700 border-rose-200",
  technician_away: "bg-amber-100 text-amber-700 border-amber-200",
  technician_sick: "bg-orange-100 text-orange-800 border-orange-200",
  public_holiday: "bg-indigo-100 text-indigo-700 border-indigo-200",
  bank_holiday: "bg-violet-100 text-violet-700 border-violet-200",
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

function isSubjectToConfirmation(job: CalendarJob): boolean {
  return Boolean(job.description && job.description.toLowerCase().startsWith("subject to confirmation"));
}

function isOnlineBookingAwaitingAdminConfirmation(job: CalendarJob): boolean {
  const description = String(job.description || "").toLowerCase();
  if (description.startsWith("subject to confirmation")) return true;

  const anyJob = job as unknown as Record<string, unknown>;
  const title = String(anyJob.title || "").toLowerCase();
  const notes = String(anyJob.notes || "").toLowerCase();
  const source = String(anyJob.source || "").toLowerCase();

  return title.includes("online booking - admin confirm")
    || notes.includes("admin confirmation required")
    || source === "website";
}

function getJobTypeDisplay(job: CalendarJob): { label: string; intent: "standard" | "estimate" | null } {
  const label = String(job.job_type_name ?? job.job_type ?? "").replace(/_/g, " ").trim() || "Job";
  const explicitIntent = job.visit_intent === "estimate" || job.visit_intent === "standard"
    ? job.visit_intent
    : null;
  const inferredIntent = /\b(estimate|quote)\b/i.test(label) ? "estimate" : null;
  return { label, intent: explicitIntent || inferredIntent };
}

function isAllDayJob(job: CalendarJob): boolean {
  return Boolean(job.all_day) || job.estimated_duration == null;
}

function getCompactJobTimeLabel(job: CalendarJob): string {
  if (isAllDayJob(job)) return "All day";
  if (!job.scheduled_time) return "No time";
  return formatTime(job.scheduled_time);
}

function CompactJobCardContent({ job, timeLabel }: { job: CalendarJob; timeLabel: string }) {
  const allDay = isAllDayJob(job);
  const durationText = allDay ? null : durationLabel(getJobDurationMinutes(job));
  return (
    <div className="space-y-0.5 min-w-0">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[job.priority] || "bg-slate-400"}`} />
          <span className="text-sm font-semibold truncate">{job.customer_name || "Unknown"}</span>
        </div>
        <span className="text-xs font-medium opacity-80 shrink-0 whitespace-nowrap">{timeLabel}</span>
      </div>
      <div className="ml-3.5 flex flex-wrap items-center gap-1">
        <AppointmentConfirmationBadge status={job.customer_confirmation_status} showPending={false} />
      </div>
      {allDay && (
        <div className="ml-3.5">
          <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800">All-day</span>
        </div>
      )}
      {durationText && (
        <div className="ml-3.5 text-[10px] font-medium opacity-75">
          Duration: {durationText}
        </div>
      )}
      {job.property_address && (
        <div className="ml-3.5 text-xs opacity-70 truncate">
          {job.property_address}
        </div>
      )}
    </div>
  );
}

interface ScheduleCalendarProps {
  onDayAction?: (date: string, action: "enquiry" | "job") => void;
}

export default function ScheduleCalendar({ onDayAction }: ScheduleCalendarProps = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateJob = useUpdateJob();

  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverEngineerLane, setDragOverEngineerLane] = useState<string | null>(null);
  const didDragRef = useRef(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<CalendarJob>>>({}); // immediate drag-drop overrides
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [dayViewLayout, setDayViewLayout] = useState<"timeline" | "lanes">("timeline");
  const [daySlotMinutes, setDaySlotMinutes] = useState<DaySlotMinutes>(DEFAULT_DAY_SLOT_MINUTES);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DAY_SLOT_STORAGE_KEY);
    const parsed = Number(stored);
    if (parsed === 5 || parsed === 15 || parsed === 30) {
      setDaySlotMinutes(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DAY_SLOT_STORAGE_KEY, String(daySlotMinutes));
  }, [daySlotMinutes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const view = params.get("view");
    const date = params.get("date");

    if (view === "day" || view === "week" || view === "month") {
      setViewMode(view);
    } else {
      setViewMode("week");
      setAnchorDate(new Date());
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parsed = new Date(`${date}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setAnchorDate(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

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

  const { data: calendarData } = useCalendarData({ date_from: dateFromStr, date_to: dateToStr });

  const rawCalendarJobs = (calendarData?.jobs ?? []) as CalendarJob[];
  const calendarHolidays = (calendarData?.holidays ?? []) as CalendarHoliday[];
  const calendarJobs = useMemo(
    () => rawCalendarJobs.map((j) => localOverrides[j.id] ? { ...j, ...localOverrides[j.id] } : j),
    [rawCalendarJobs, localOverrides]
  );

  // Clear overrides only once server data has caught up — avoids stale-cache snap-back
  useEffect(() => {
    setLocalOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      for (const jobId of Object.keys(next)) {
        const raw = rawCalendarJobs.find((j) => j.id === jobId);
        if (!raw) continue;
        const override = next[jobId];
        const allMatch = Object.entries(override).every(
          ([k, v]) => raw[k as keyof CalendarJob] === v
        );
        if (allMatch) { delete next[jobId]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [rawCalendarJobs]);

  const profiles = (calendarData?.profiles ?? []) as Array<{ id: string; full_name: string; role: string; [k: string]: unknown }>;

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
        const aAllDay = isAllDayJob(a);
        const bAllDay = isAllDayJob(b);
        if (aAllDay !== bAllDay) {
          return aAllDay ? -1 : 1;
        }
        const ta = a.scheduled_time || "99:99";
        const tb = b.scheduled_time || "99:99";
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [calendarJobs, days]);

  const holidaysByDate = useMemo(() => {
    const map: Record<string, CalendarHoliday[]> = {};
    for (const day of days) {
      map[toDateStr(day)] = [];
    }
    for (const holiday of calendarHolidays) {
      const start = String(holiday.start_date).slice(0, 10);
      const end = String(holiday.end_date).slice(0, 10);
      for (const day of days) {
        const ds = toDateStr(day);
        if (ds >= start && ds <= end && map[ds]) {
          map[ds].push(holiday);
        }
      }
    }
    return map;
  }, [calendarHolidays, days]);

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
    else setAnchorDate(new Date());
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

  const openDayView = useCallback((day: Date) => {
    setPopoverDate(null);
    setViewMode("day");
    setAnchorDate(new Date(day));
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, newDateStr: string, newTime?: string | null) => {
      e.preventDefault();
      setDragOverDate(null);
      setDragOverSlot(null);
      setDragJobId(null);
      if (!canDrag) return;

      const jobId = e.dataTransfer.getData("text/plain");
      if (!jobId) return;

      const job = calendarJobs.find((j) => j.id === jobId);
      if (!job) return;

      const oldDateStr = String(job.scheduled_date).slice(0, 10);
      const oldTime = job.scheduled_time || null;
      const timeChanged = newTime !== undefined && newTime !== oldTime;
      const dateChanged = oldDateStr !== newDateStr;
      if (!dateChanged && !timeChanged) return;

      const updateData: Record<string, string | null> = {};
      if (dateChanged) {
        updateData.scheduled_date = newDateStr;
      }
      if (newTime !== undefined) {
        updateData.scheduled_time = newTime;
      }

      if (dateChanged && job.scheduled_end_date) {
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

      // Apply local override immediately so the card moves on screen
      const override: Partial<CalendarJob> = {
        scheduled_date: newDateStr,
        ...(newTime !== undefined ? { scheduled_time: newTime } : {}),
        ...(updateData.scheduled_end_date != null ? { scheduled_end_date: updateData.scheduled_end_date } : {}),
      };
      setLocalOverrides((prev) => ({ ...prev, [jobId]: override }));

      try {
        await updateJob.mutateAsync({
          id: jobId,
          data: updateData as { scheduled_date: string },
        });
        qc.invalidateQueries({ queryKey: ["api/jobs"] });
        qc.invalidateQueries({ queryKey: ["/api/calendar"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
        qc.invalidateQueries({ queryKey: ["homepage"] });
        // Override is cleared by the useEffect once rawCalendarJobs reflects the new value
        const parts: string[] = [];
        if (dateChanged) {
          parts.push(new Date(newDateStr + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }));
        }
        if (timeChanged && newTime) {
          parts.push(formatTime(newTime));
        } else if (timeChanged && !newTime) {
          parts.push("no set time");
        }
        toast({
          title: "Job rescheduled",
          description: `Moved to ${parts.join(" at ")}`,
        });
      } catch {
        // Roll back — remove override to restore original position
        setLocalOverrides((prev) => { const n = { ...prev }; delete n[jobId]; return n; });
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

  const canViewEngineerLanes = profile?.role !== "technician" && visibleTechs.length > 0;
  const engineerLanes = useMemo(
    () => [
      { id: null as string | null, name: "Unassigned" },
      ...visibleTechs.map((tech) => ({ id: tech.id, name: tech.full_name || "Engineer" })),
    ],
    [visibleTechs]
  );

  const handleDropTechnician = useCallback(
    async (e: DragEvent<HTMLDivElement>, newDateStr: string, technicianId: string | null) => {
      e.preventDefault();
      setDragOverEngineerLane(null);
      setDragOverDate(null);
      setDragOverSlot(null);
      setDragJobId(null);
      if (!canDrag) return;

      const jobId = e.dataTransfer.getData("text/plain");
      if (!jobId) return;

      const job = calendarJobs.find((j) => j.id === jobId);
      if (!job) return;

      const oldDateStr = String(job.scheduled_date).slice(0, 10);
      const dateChanged = oldDateStr !== newDateStr;
      const assignmentChanged = (job.assigned_technician_id || null) !== technicianId;
      if (!dateChanged && !assignmentChanged) return;

      const technicianName = technicianId
        ? (visibleTechs.find((tech) => tech.id === technicianId)?.full_name || null)
        : null;

      const updateData: Record<string, string | null> = {
        assigned_technician_id: technicianId,
      };
      if (dateChanged) {
        updateData.scheduled_date = newDateStr;
      }

      const override: Partial<CalendarJob> = {
        assigned_technician_id: technicianId,
        technician_name: technicianName,
        ...(dateChanged ? { scheduled_date: newDateStr } : {}),
      };
      setLocalOverrides((prev) => ({ ...prev, [jobId]: override }));

      try {
        await updateJob.mutateAsync({
          id: jobId,
          data: updateData as unknown as { scheduled_date: string },
        });
        qc.invalidateQueries({ queryKey: ["api/jobs"] });
        qc.invalidateQueries({ queryKey: ["/api/calendar"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
        qc.invalidateQueries({ queryKey: ["homepage"] });

        toast({
          title: "Job reassigned",
          description: technicianName ? `Assigned to ${technicianName}` : "Moved to unassigned",
        });
      } catch {
        setLocalOverrides((prev) => { const n = { ...prev }; delete n[jobId]; return n; });
        toast({
          title: "Failed to reassign",
          description: "Could not update the job. Please try again.",
          variant: "destructive",
        });
      }
    },
    [canDrag, calendarJobs, visibleTechs, updateJob, qc, toast]
  );

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
                setAnchorDate(new Date());
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

          {(viewMode === "day" || viewMode === "week") && canViewEngineerLanes && (
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setDayViewLayout("timeline")}
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${dayViewLayout === "timeline" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setDayViewLayout("lanes")}
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${dayViewLayout === "lanes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Engineer Lanes
              </button>
            </div>
          )}

          {viewMode === "day" && (
            <div className="flex bg-muted rounded-lg p-0.5">
              {[5, 15, 30].map((minutes) => {
                const isActive = daySlotMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDaySlotMinutes(minutes as DaySlotMinutes)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${isActive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {minutes}m
                  </button>
                );
              })}
            </div>
          )}

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
        const allDayJobs = dayJobs.filter(isAllDayJob);
        const dayHolidays = holidaysByDate[ds] || [];
        const timedDayHolidays = dayHolidays.filter((h) => isTimedSingleDayHoliday(h, ds));
        const allDayDayHolidays = dayHolidays.filter((h) => !isTimedSingleDayHoliday(h, ds));
        const isToday = isSameDay(ds, todayStr);
        const jobsBySlot: Record<number, Array<{ job: CalendarJob; slotIndex: number; totalSlots: number; durationMinutes: number }>> = {};
        const holidaysBySlot: Record<number, Array<{ holiday: CalendarHoliday; slotIndex: number; totalSlots: number; durationMinutes: number }>> = {};
        const unscheduled: CalendarJob[] = [];
        let minSlotStart = 7 * 60;
        let maxSlotStart = 20 * 60;
        for (const job of dayJobs) {
          if (isAllDayJob(job)) {
            continue;
          }

          if (job.scheduled_time) {
            const durationMinutes = getJobDurationMinutes(job);
            const slotStarts = getSlotStartsForDuration(job.scheduled_time, durationMinutes, daySlotMinutes);
            if (slotStarts.length === 0) continue;
            minSlotStart = Math.min(minSlotStart, slotStarts[0]);
            maxSlotStart = Math.max(maxSlotStart, slotStarts[slotStarts.length - 1]);
            slotStarts.forEach((slotStart, slotIndex) => {
              if (!jobsBySlot[slotStart]) jobsBySlot[slotStart] = [];
              jobsBySlot[slotStart].push({ job, slotIndex, totalSlots: slotStarts.length, durationMinutes });
            });
          } else {
            unscheduled.push(job);
          }
        }
        for (const holiday of timedDayHolidays) {
          const durationMinutes = getHolidayDurationMinutes(holiday);
          const slotStarts = getSlotStartsForDuration(String(holiday.start_time), durationMinutes, daySlotMinutes);
          if (slotStarts.length === 0) continue;
          minSlotStart = Math.min(minSlotStart, slotStarts[0]);
          maxSlotStart = Math.max(maxSlotStart, slotStarts[slotStarts.length - 1]);
          slotStarts.forEach((slotStart, slotIndex) => {
            if (!holidaysBySlot[slotStart]) holidaysBySlot[slotStart] = [];
            holidaysBySlot[slotStart].push({ holiday, slotIndex, totalSlots: slotStarts.length, durationMinutes });
          });
        }
        const SLOT_COUNT = Math.floor((maxSlotStart - minSlotStart) / daySlotMinutes) + 1;
        const TIME_SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => minSlotStart + (i * daySlotMinutes));
        const slotRowClass = daySlotMinutes === 5 ? "min-h-[22px]" : daySlotMinutes === 15 ? "min-h-[30px]" : "min-h-[42px]";

        if (dayViewLayout === "lanes" && canViewEngineerLanes) {
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

              {allDayDayHolidays.length > 0 && (
                <div className="px-4 py-2 border-b border-border bg-muted/20 flex flex-wrap gap-1.5">
                  {allDayDayHolidays.map((h) => (
                    <span key={h.id} className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${HOLIDAY_STYLES[h.holiday_type]}`}>
                      {h.name}{h.technician_name ? ` - ${h.technician_name}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {allDayJobs.length > 0 && (
                <div className="border-b border-border bg-sky-50/70">
                  <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-700">
                    <CalendarDays className="w-3.5 h-3.5" />
                    All-day bookings
                  </div>
                  <div className="px-2 pb-2">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {allDayJobs.map((job) => (
                        <div
                          key={job.id}
                          data-job-card
                          role="button"
                          tabIndex={0}
                          draggable={canDrag}
                          onDragStart={(e) => handleDragStart(e, job.id)}
                          onDragEnd={() => { didDragRef.current = false; setDragOverSlot(null); }}
                          onClick={(e) => handleJobClick(e, job.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                          className={`px-3 py-2 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm transition-all cursor-pointer ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-md`}
                        >
                          <CompactJobCardContent job={job} timeLabel="All day" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 overflow-x-auto">
                <div className="grid gap-3 min-w-max" style={{ gridTemplateColumns: `repeat(${engineerLanes.length}, minmax(260px, 1fr))` }}>
                  {engineerLanes.map((lane) => {
                    const laneKey = lane.id || "unassigned";
                    const laneDropKey = `${ds}-${laneKey}`;
                    const isLaneTarget = dragOverEngineerLane === laneDropKey;
                    const laneJobs = dayJobs
                      .filter((job) => (job.assigned_technician_id || null) === lane.id)
                      .sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));

                    return (
                      <div
                        key={laneKey}
                        className={`rounded-lg border bg-background min-h-[420px] transition-colors ${isLaneTarget ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverEngineerLane(laneDropKey);
                          setDragOverDate(null);
                          setDragOverSlot(null);
                        }}
                        onDragLeave={() => setDragOverEngineerLane(null)}
                        onDrop={(e) => handleDropTechnician(e, ds, lane.id)}
                      >
                        <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{lane.name}</span>
                          <span className="text-xs text-muted-foreground">{laneJobs.length}</span>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {laneJobs.length === 0 && (
                            <div className="text-xs text-muted-foreground border border-dashed rounded-md px-2 py-3 text-center">
                              Drop jobs here to assign
                            </div>
                          )}
                          {laneJobs.map((job) => (
                            <div
                              key={job.id}
                              data-job-card
                              role="button"
                              tabIndex={0}
                              draggable={canDrag}
                              onDragStart={(e) => handleDragStart(e, job.id)}
                              onDragEnd={() => { didDragRef.current = false; setDragOverEngineerLane(null); }}
                              onClick={(e) => handleJobClick(e, job.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                              className={`px-3 py-2 rounded-lg border transition-all cursor-pointer ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-sm`}
                            >
                              <CompactJobCardContent job={job} timeLabel={getJobTimeRangeLabel(job)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

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

              {allDayDayHolidays.length > 0 && (
              <div className="px-4 py-2 border-b border-border bg-muted/20 flex flex-wrap gap-1.5">
                {allDayDayHolidays.map((h) => (
                  <span key={h.id} className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${HOLIDAY_STYLES[h.holiday_type]}`}>
                    {h.name}{h.technician_name ? ` - ${h.technician_name}` : ""}
                  </span>
                ))}
              </div>
            )}

            {allDayJobs.length > 0 && (
              <div className="border-b border-border bg-sky-50/70">
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-700">
                  <CalendarDays className="w-3.5 h-3.5" />
                  All-day bookings
                </div>
                <div className="px-2 pb-2">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {allDayJobs.map((job) => (
                      <div
                        key={job.id}
                        data-job-card
                        role="button"
                        tabIndex={0}
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={() => { didDragRef.current = false; setDragOverSlot(null); }}
                        onClick={(e) => handleJobClick(e, job.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                        className={`px-3 py-2 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm transition-all cursor-pointer ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-md`}
                      >
                        <CompactJobCardContent job={job} timeLabel="All day" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-background">
              {TIME_SLOTS.map((slotStart) => {
                const jobs = jobsBySlot[slotStart] || [];
                const timedHolidays = holidaysBySlot[slotStart] || [];
                const timeStr = formatTime24FromMinutes(slotStart);
                const slotKey = `${ds}-${slotStart}`;
                const isSlotTarget = dragOverSlot === slotKey;
                const minuteOfHour = slotStart % 60;
                const showRowLabel = daySlotMinutes === 5
                  ? minuteOfHour === 0
                  : daySlotMinutes === 15
                    ? minuteOfHour === 0 || minuteOfHour === 30
                    : true;
                const showContinuationSummary = minuteOfHour === 0 || daySlotMinutes >= 30;
                return (
                  <div
                    key={slotStart}
                    className={`flex border-b border-border/40 last:border-b-0 ${slotRowClass} transition-colors ${isSlotTarget ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverSlot(slotKey); setDragOverDate(null); }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={(e) => handleDrop(e, ds, timeStr)}
                  >
                    <div className={`w-16 shrink-0 px-2 py-1 text-[11px] font-medium text-muted-foreground border-r border-border/50 flex items-start justify-end ${minuteOfHour === 0 ? "bg-muted/35" : "bg-muted/20"}`}>
                      {showRowLabel ? formatTimeFromMinutes(slotStart) : ""}
                    </div>
                    <div className="flex-1 p-1 space-y-1">
                      {timedHolidays.map(({ holiday, slotIndex, totalSlots, durationMinutes }) => (
                        slotIndex === 0 ? (
                          <div
                            key={`${holiday.id}-${slotStart}`}
                            className={`px-3 py-2 rounded-lg border ${HOLIDAY_STYLES[holiday.holiday_type]}`}
                            title={holiday.notes || undefined}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-sm font-semibold">{holiday.name}</span>
                              <span className="ml-auto text-[11px] font-medium opacity-90">{holidayTimeRangeLabel(holiday)}</span>
                            </div>
                            <div className="mt-1 text-xs opacity-80">
                              {holiday.technician_name ? `Technician: ${holiday.technician_name}` : "Technician leave"}
                              {` · ${durationLabel(durationMinutes)}`}
                              {holiday.notes ? ` · ${holiday.notes}` : ""}
                            </div>
                          </div>
                        ) : (
                          <div
                            key={`${holiday.id}-${slotStart}`}
                            className={`px-3 py-2 rounded-lg border ${HOLIDAY_STYLES[holiday.holiday_type]} opacity-90`}
                            title={`${holiday.name} (${holidayTimeRangeLabel(holiday)})`}
                          >
                            {showContinuationSummary ? (
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-sm font-semibold">{holiday.name} (continues)</span>
                                <span className="ml-auto text-[11px] font-medium opacity-90">{getSlotRangeLabel(slotStart, daySlotMinutes)}</span>
                              </div>
                            ) : (
                              <div className="h-2 rounded bg-current/20" />
                            )}
                          </div>
                        )
                      ))}
                      {jobs.length > 0 && (
                        <div
                          className={`space-y-1 sm:space-y-0 ${jobs.length > 1 ? "sm:grid sm:gap-1" : ""}`}
                          style={jobs.length > 1 ? { gridTemplateColumns: `repeat(${Math.min(jobs.length, 3)}, minmax(0, 1fr))` } : undefined}
                        >
                          {jobs.map(({ job, slotIndex, totalSlots, durationMinutes }) => (
                            slotIndex === 0 ? (
                            <div
                              key={`${job.id}-${slotStart}`}
                              data-job-card
                              role="button"
                              tabIndex={0}
                              draggable={canDrag}
                              onDragStart={(e) => handleDragStart(e, job.id)}
                              onDragEnd={() => { didDragRef.current = false; setDragOverSlot(null); }}
                              onClick={(e) => handleJobClick(e, job.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                              className={`px-3 py-2 rounded-lg border transition-all cursor-pointer min-w-0 ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-sm`}
                            >
                              <CompactJobCardContent job={job} timeLabel={getJobTimeRangeLabel(job)} />
                            </div>
                            ) : (
                              <div
                                key={`${job.id}-${slotStart}`}
                                data-job-card
                                role="button"
                                tabIndex={0}
                                draggable={canDrag}
                                onDragStart={(e) => handleDragStart(e, job.id)}
                                onDragEnd={() => { didDragRef.current = false; setDragOverSlot(null); }}
                                onClick={(e) => handleJobClick(e, job.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer min-w-0 ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-sm opacity-90`}
                              >
                                {showContinuationSummary ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[job.priority] || "bg-slate-400"}`} />
                                    <span className="text-sm font-semibold truncate">{job.customer_name || "Unknown"} (continues)</span>
                                    <span className="ml-auto text-xs opacity-80 shrink-0">{isAllDayJob(job) ? "All day" : getSlotRangeLabel(slotStart, daySlotMinutes)}</span>
                                  </div>
                                ) : (
                                  <div className="h-2 rounded bg-current/20" />
                                )}
                                <div className="text-[11px] opacity-70 mt-1 ml-4 truncate">
                                  {getJobTimeRangeLabel(job)}
                                </div>
                                  <CompactJobCardContent job={job} timeLabel={getJobTimeRangeLabel(job)} />
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {(() => {
                const noTimeSlotKey = `${ds}-notime`;
                const isNoTimeTarget = dragOverSlot === noTimeSlotKey;
                const showNoTime = unscheduled.length > 0 || dragJobId;
                if (!showNoTime) return null;
                return (
                <div className="border-t-2 border-dashed border-border">
                  <div
                    className={`flex min-h-[52px] transition-colors ${isNoTimeTarget ? "bg-primary/10" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverSlot(noTimeSlotKey); setDragOverDate(null); }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={(e) => handleDrop(e, ds, null)}
                  >
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
                          draggable={canDrag}
                          onDragStart={(e) => handleDragStart(e, job.id)}
                          onDragEnd={() => { didDragRef.current = false; setDragOverSlot(null); }}
                          onClick={(e) => handleJobClick(e, job.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                          className={`px-3 py-2 rounded-lg border transition-all cursor-pointer ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-sm`}
                        >
                              <CompactJobCardContent job={job} timeLabel={getJobTimeRangeLabel(job)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })()}
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

      {viewMode === "week" && dayViewLayout === "lanes" && canViewEngineerLanes && <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-3">
          {days.map((day) => {
            const ds = toDateStr(day);
            const dayJobs = (jobsByDate[ds] || []).slice().sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));
            const dayHolidays = holidaysByDate[ds] || [];
            const isToday = isSameDay(ds, todayStr);

            return (
              <div key={ds} className={`rounded-xl border overflow-hidden ${isToday ? "border-primary/40 bg-primary/[0.03]" : "border-border bg-background"}`}>
                <div className="px-2 py-2 border-b bg-muted/40">
                  <div className="text-xs font-semibold text-foreground">{formatDayHeader(day)}</div>
                  <div className="text-[11px] text-muted-foreground">{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</div>
                </div>

                {dayHolidays.length > 0 && (
                  <div className="px-2 py-1.5 border-b bg-muted/20 space-y-1">
                    {dayHolidays.slice(0, 2).map((holiday) => (
                      <div
                        key={holiday.id}
                        className={`text-[10px] leading-tight px-1.5 py-1 rounded border ${HOLIDAY_STYLES[holiday.holiday_type]}`}
                        title={holiday.technician_name ? `${holiday.name} (${holiday.technician_name})` : holiday.name}
                      >
                        {holiday.name}
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                  {engineerLanes.map((lane) => {
                    const laneKey = lane.id || "unassigned";
                    const laneDropKey = `${ds}-${laneKey}`;
                    const laneJobs = dayJobs.filter((job) => (job.assigned_technician_id || null) === lane.id);
                    const isLaneTarget = dragOverEngineerLane === laneDropKey;

                    return (
                      <div
                        key={laneKey}
                        className={`rounded-md border bg-background transition-colors ${isLaneTarget ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverEngineerLane(laneDropKey);
                          setDragOverDate(null);
                          setDragOverSlot(null);
                        }}
                        onDragLeave={() => setDragOverEngineerLane(null)}
                        onDrop={(e) => handleDropTechnician(e, ds, lane.id)}
                      >
                        <div className="px-2 py-1 border-b bg-muted/30 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-foreground truncate">{lane.name}</span>
                          <span className="text-[10px] text-muted-foreground">{laneJobs.length}</span>
                        </div>
                        <div className="p-1.5 space-y-1">
                          {laneJobs.length === 0 && (
                            <div className="text-[10px] text-muted-foreground border border-dashed rounded px-1.5 py-1.5 text-center">
                              Drop
                            </div>
                          )}
                          {laneJobs.map((job) => (
                            <div
                              key={job.id}
                              data-job-card
                              role="button"
                              tabIndex={0}
                              draggable={canDrag}
                              onDragStart={(e) => handleDragStart(e, job.id)}
                              onDragEnd={() => { didDragRef.current = false; setDragOverEngineerLane(null); }}
                              onClick={(e) => handleJobClick(e, job.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/jobs/${job.id}`); }}
                              className={`px-1.5 py-1 rounded border transition-all cursor-pointer ${STATUS_COLORS[job.status] || "bg-gray-50 text-gray-700 border-gray-200"} ${canDrag ? "hover:cursor-grab active:cursor-grabbing" : ""} ${dragJobId === job.id ? "opacity-50" : ""} hover:shadow-sm`}
                            >
                              <CompactJobCardContent job={job} timeLabel={getJobTimeRangeLabel(job)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {!(viewMode === "week" && dayViewLayout === "lanes" && canViewEngineerLanes) && viewMode !== "day" && <div className="hidden sm:block">
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
            const dayHolidays = holidaysByDate[ds] || [];
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
                  (viewMode === "week" || viewMode === "month" || onDayAction) ? "cursor-pointer hover:bg-muted/30" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, ds)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, ds)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-job-card]")) return;
                  if (viewMode === "week" || viewMode === "month") {
                    e.stopPropagation();
                    openDayView(day);
                    return;
                  }
                  if (!onDayAction) return;
                  e.stopPropagation();
                  setPopoverDate(showPopover ? null : ds);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); openDayView(day); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openDayView(day); } }}
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
                  {viewMode === "month" && onDayAction && (
                    <button
                      type="button"
                      className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopoverDate(showPopover ? null : ds);
                      }}
                      title="Create job or enquiry for this day"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className={`space-y-0.5 ${viewMode === "week" ? "overflow-visible sm:max-h-none" : "overflow-y-auto max-h-[110px]"}`}>
                  {dayHolidays.slice(0, 2).map((holiday) => (
                    <div
                      key={holiday.id}
                      className={`block text-[10px] leading-tight px-1.5 py-1 rounded border ${HOLIDAY_STYLES[holiday.holiday_type]}`}
                      title={holiday.technician_name ? `${holiday.name} (${holiday.technician_name})` : holiday.name}
                    >
                      <span className="font-medium">{holiday.name}</span>
                      {holiday.technician_name && <span className="opacity-80"> · {holiday.technician_name}</span>}
                    </div>
                  ))}
                  {dayJobs.slice(0, viewMode === "month" ? 3 : viewMode === "week" ? dayJobs.length : 6).map((job) => (
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
                      <CompactJobCardContent job={job} timeLabel={getCompactJobTimeLabel(job)} />
                    </div>
                  ))}
                  {dayJobs.length > (viewMode === "month" ? 3 : viewMode === "week" ? dayJobs.length : 6) && (
                    <span className="text-[10px] text-muted-foreground pl-1.5">
                      +{dayJobs.length - (viewMode === "month" ? 3 : viewMode === "week" ? dayJobs.length : 6)} more
                    </span>
                  )}
                  {dayHolidays.length > 2 && (
                    <span className="text-[10px] text-muted-foreground pl-1.5">
                      +{dayHolidays.length - 2} holiday{dayHolidays.length - 2 > 1 ? "s" : ""}
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

          if (viewMode === "month" && day.getMonth() !== anchorDate.getMonth()) return null;

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
                      <CompactJobCardContent job={job} timeLabel={getCompactJobTimeLabel(job)} />
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
          {viewMode === "day"
            ? "Drag and drop jobs to different time slots to reschedule"
            : "Drag and drop jobs between days to reschedule"}
        </p>
      )}
    </Card>
  );
}
