import type { Response } from "express";
import { supabaseAdmin } from "./supabase";

export type TechnicianLeaveConflict = {
  technician_id: string;
  technician_name: string | null;
  holiday_type: "technician_leave" | "technician_away" | "technician_sick";
  holiday_name: string;
  start_date: string;
  end_date: string;
};

export async function findTechnicianLeaveConflict(args: {
  tenantId: string;
  technicianId: string | null | undefined;
  scheduledDate: string | null | undefined;
  scheduledEndDate: string | null | undefined;
}): Promise<TechnicianLeaveConflict | null> {
  const { tenantId, technicianId, scheduledDate, scheduledEndDate } = args;
  if (!technicianId || !scheduledDate) return null;

  const effectiveEndDate = scheduledEndDate || scheduledDate;
  const { data: holiday } = await supabaseAdmin
    .from("calendar_holidays")
    .select("technician_id, holiday_type, name, start_date, end_date, profiles!calendar_holidays_technician_id_fkey(full_name)")
    .eq("tenant_id", tenantId)
    .eq("technician_id", technicianId)
    .in("holiday_type", ["technician_leave", "technician_away", "technician_sick"])
    .lte("start_date", effectiveEndDate)
    .gte("end_date", scheduledDate)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!holiday) return null;

  const profile = holiday.profiles as { full_name?: string | null } | null;
  return {
    technician_id: technicianId,
    technician_name: profile?.full_name ?? null,
    holiday_type: holiday.holiday_type,
    holiday_name: holiday.name,
    start_date: holiday.start_date,
    end_date: holiday.end_date,
  };
}

export function sendTechnicianLeaveConflict(
  res: Response,
  conflict: TechnicianLeaveConflict,
  extras?: Record<string, unknown>,
): void {
  res.status(409).json({
    error: `${conflict.technician_name || "This technician"} is unavailable due to ${conflict.holiday_name} (${conflict.start_date} to ${conflict.end_date}).`,
    code: "TECHNICIAN_LEAVE_CONFLICT",
    conflict,
    ...(extras || {}),
  });
}