import type { Response } from "express";
import { supabaseAdmin } from "./supabase";

export type TechnicianJobClash = {
  existing_job_id: string;
  existing_job_ref: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  scheduled_end_date?: string;
  estimated_duration: number;
};

function minuteOfDay(value: string): number {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error("Cannot check appointment clashes: invalid appointment time.");
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationMinutes(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? Math.round(value) : 60;
}

function dateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Cannot check appointment clashes: invalid appointment date.");
  }
  return date.toISOString().slice(0, 10);
}

function bookingWindow(startDate: string, endDate: string, time: string | null | undefined, allDay: boolean, duration: number | null | undefined) {
  const startDay = Date.parse(startDate) / 60000;
  const endDay = Date.parse(endDate) / 60000;
  if (endDay < startDay) throw new Error("Cannot check appointment clashes: end date is before start date.");
  if (allDay || !time) return { start: startDay + 480, end: endDay + 1020, daily: true };
  const startTime = minuteOfDay(time);
  return { start: startDay + startTime, end: endDay + startTime + durationMinutes(duration), daily: false };
}

function windowsOverlap(a: ReturnType<typeof bookingWindow>, b: ReturnType<typeof bookingWindow>): boolean {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (start >= end) return false;
  if (!a.daily && !b.daily) return true;
  const day = Math.floor(start / 1440) * 1440;
  const nextWorkingMinute = start < day + 480 ? day + 480 : start >= day + 1020 ? day + 1440 + 480 : start;
  return nextWorkingMinute < end;
}

export async function findTechnicianJobClash(args: {
  tenantId: string;
  technicianId: string | null | undefined;
  scheduledDate: string | Date | null | undefined;
  scheduledEndDate?: string | Date | null;
  scheduledTime: string | null | undefined;
  allDay?: boolean | null;
  estimatedDuration: number | null | undefined;
  excludeJobId?: string;
}): Promise<TechnicianJobClash | null> {
  const { tenantId, technicianId, scheduledDate, scheduledEndDate, scheduledTime, allDay, estimatedDuration, excludeJobId } = args;
  if (!technicianId || !scheduledDate) return null;

  const startDate = dateKey(scheduledDate);
  const endDate = scheduledEndDate ? dateKey(scheduledEndDate) : startDate;
  const window = bookingWindow(startDate, endDate, scheduledTime, allDay === true, estimatedDuration);
  let query = supabaseAdmin
    .from("job_schedule_entries")
    .select("id, job_id, job_ref, scheduled_date, scheduled_end_date, scheduled_time, all_day, estimated_duration, status")
    .eq("tenant_id", tenantId)
    .eq("assigned_technician_id", technicianId)
    .lte("scheduled_date", endDate)
    .or(`scheduled_end_date.gte.${startDate},and(scheduled_end_date.is.null,scheduled_date.gte.${startDate})`)
    .eq("is_active", true)
    .not("status", "in", "(cancelled,completed,invoiced)")
    .order("scheduled_time", { ascending: true });
  if (excludeJobId) query = query.neq("id", excludeJobId);

  const { data: jobs, error } = await query;
  if (error) {
    console.error("[job-clashes] Failed to check engineer availability:", error);
    throw new Error("Unable to check appointment clashes. Please try again before booking.");
  }
  const clash = jobs?.find(job => {
    const existing = bookingWindow(
      dateKey(job.scheduled_date),
      dateKey(job.scheduled_end_date || job.scheduled_date),
      job.scheduled_time,
      job.all_day === true,
      job.estimated_duration,
    );
    return windowsOverlap(window, existing);
  });
  return clash ? {
    existing_job_id: clash.job_id ?? clash.id,
    existing_job_ref: clash.job_ref ?? null,
    scheduled_date: clash.scheduled_date,
    scheduled_time: clash.all_day === true ? null : clash.scheduled_time,
    ...(clash.scheduled_end_date && clash.scheduled_end_date !== clash.scheduled_date
      ? { scheduled_end_date: clash.scheduled_end_date } : {}),
    estimated_duration: durationMinutes(clash.estimated_duration),
  } : null;
}

export function sendTechnicianJobClash(res: Response, clash: TechnicianJobClash): void {
  const label = clash.existing_job_ref || `#${clash.existing_job_id.slice(0, 8)}`;
  const time = clash.scheduled_time ? `at ${clash.scheduled_time.slice(0, 5)}` : "booked all day";
  const dates = clash.scheduled_end_date ? `from ${clash.scheduled_date} to ${clash.scheduled_end_date}` : `on ${clash.scheduled_date}`;
  res.status(409).json({
    error: `This technician already has job ${label} ${time} ${dates}.`,
    code: "TECHNICIAN_JOB_CLASH",
    conflict: clash,
  });
}
