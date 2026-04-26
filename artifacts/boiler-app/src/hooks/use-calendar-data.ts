import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface CalendarJob {
  id: string;
  customer_name?: string | null;
  property_address?: string | null;
  technician_name?: string | null;
  assigned_technician_id?: string | null;
  job_type: string;
  job_type_name?: string | null;
  status: string;
  priority: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  scheduled_end_date?: string | null;
  arrival_time?: string | null;
  departure_time?: string | null;
  property_latitude?: number | null;
  property_longitude?: number | null;
  property_postcode?: string | null;
}

interface CalendarProfile {
  id: string;
  full_name: string;
  role: string;
  [k: string]: unknown;
}

interface CalendarData {
  jobs: CalendarJob[];
  profiles: CalendarProfile[];
  date_range: { date_from: string; date_to: string };
}

export function useCalendarData(params?: { date_from?: string; date_to?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  const qs = searchParams.toString();

  return useQuery<CalendarData>({
    queryKey: ["/api/calendar", qs],
    queryFn: () =>
      customFetch(`${import.meta.env.BASE_URL}api/calendar${qs ? `?${qs}` : ""}`) as Promise<CalendarData>,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
}
