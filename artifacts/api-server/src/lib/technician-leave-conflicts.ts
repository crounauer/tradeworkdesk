import type { Response } from "express";
import { supabaseAdmin } from "./supabase";

export type TechnicianLeaveConflict = {
  technician_id: string;
  technician_name: string | null;
  holiday_type: "technician_leave" | "technician_away" | "technician_sick";
  holiday_name: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
};

function toMinuteOfDay(timeValue: string): number | null {
  const match = String(timeValue).match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function holidayOverlapsScheduledWindow(args: {
  holidayStartDate: string;
  holidayEndDate: string;
  holidayStartTime: string | null;
  holidayEndTime: string | null;
  scheduledDate: string;
  scheduledEndDate: string;
  scheduledTime?: string | null;
  durationMinutes?: number | null;
}): boolean {
  const {
    holidayStartDate,
    holidayEndDate,
    holidayStartTime,
    holidayEndTime,
    scheduledDate,
    scheduledEndDate,
    scheduledTime,
    durationMinutes,
  } = args;

  if (holidayStartDate > scheduledEndDate || holidayEndDate < scheduledDate) return false;
  if (!holidayStartTime || !holidayEndTime) return true;
  if (!scheduledTime || scheduledDate !== scheduledEndDate) return true;
  if (scheduledDate !== holidayStartDate || scheduledDate !== holidayEndDate) return false;

  const holidayStartMinutes = toMinuteOfDay(holidayStartTime);
  const holidayEndMinutes = toMinuteOfDay(holidayEndTime);
  const scheduledStartMinutes = toMinuteOfDay(scheduledTime);
  const parsedDuration = Number(durationMinutes || 60);
  const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60;
  if (holidayStartMinutes == null || holidayEndMinutes == null || scheduledStartMinutes == null) return true;

  const scheduledEndMinutes = scheduledStartMinutes + safeDuration;
  return scheduledStartMinutes < holidayEndMinutes && scheduledEndMinutes > holidayStartMinutes;
}

function formatConflictSpan(startDate: string, endDate: string, startTime?: string | null, endTime?: string | null): string {
  if (startDate === endDate && startTime && endTime) {
    return `${startDate} ${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`;
  }
  return `${startDate} to ${endDate}`;
}

export async function findTechnicianLeaveConflict(args: {
  tenantId: string;
  technicianId: string | null | undefined;
  scheduledDate: string | null | undefined;
  scheduledEndDate: string | null | undefined;
  scheduledTime?: string | null;
  durationMinutes?: number | null;
}): Promise<TechnicianLeaveConflict | null> {
  const { tenantId, technicianId, scheduledDate, scheduledEndDate, scheduledTime, durationMinutes } = args;
  if (!technicianId || !scheduledDate) return null;

  const effectiveEndDate = scheduledEndDate || scheduledDate;
  const { data: holidayRows } = await supabaseAdmin
    .from("calendar_holidays")
    .select("technician_id, holiday_type, name, start_date, end_date, start_time, end_time, profiles!calendar_holidays_technician_id_fkey(full_name)")
    .eq("tenant_id", tenantId)
    .eq("technician_id", technicianId)
    .in("holiday_type", ["technician_leave", "technician_away", "technician_sick"])
    .lte("start_date", effectiveEndDate)
    .gte("end_date", scheduledDate)
    .order("start_date", { ascending: true })
    .limit(20);

  const holiday = (holidayRows || []).find((row) => holidayOverlapsScheduledWindow({
    holidayStartDate: row.start_date,
    holidayEndDate: row.end_date,
    holidayStartTime: row.start_time,
    holidayEndTime: row.end_time,
    scheduledDate,
    scheduledEndDate: effectiveEndDate,
    scheduledTime,
    durationMinutes,
  }));

  if (!holiday) return null;

  const profile = holiday.profiles as { full_name?: string | null } | null;
  return {
    technician_id: technicianId,
    technician_name: profile?.full_name ?? null,
    holiday_type: holiday.holiday_type,
    holiday_name: holiday.name,
    start_date: holiday.start_date,
    end_date: holiday.end_date,
    start_time: holiday.start_time,
    end_time: holiday.end_time,
  };
}

export function sendTechnicianLeaveConflict(
  res: Response,
  conflict: TechnicianLeaveConflict,
  extras?: Record<string, unknown>,
): void {
  const span = formatConflictSpan(conflict.start_date, conflict.end_date, conflict.start_time, conflict.end_time);
  res.status(409).json({
    error: `${conflict.technician_name || "This technician"} is unavailable due to ${conflict.holiday_name} (${span}).`,
    code: "TECHNICIAN_LEAVE_CONFLICT",
    conflict,
    ...(extras || {}),
  });
}