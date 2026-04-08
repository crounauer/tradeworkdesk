import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

export interface HomepageData {
  dashboard: unknown;
  calendar_jobs: { jobs: unknown[]; pagination: unknown };
  calendar_date_range: { date_from: string; date_to: string };
  profiles: unknown[];
}

export function useHomepageData() {
  const qc = useQueryClient();
  const seededRef = useRef(false);

  const result = useQuery<HomepageData>({
    queryKey: ["homepage"],
    queryFn: async () => {
      const res = await fetch("/api/homepage");
      if (!res.ok) throw new Error("Failed to fetch homepage data");
      const data: HomepageData = await res.json();

      const { date_from, date_to } = data.calendar_date_range;
      qc.setQueryData(["/api/jobs", { date_from, date_to, limit: 500 }], data.calendar_jobs);
      qc.setQueryData(["/api/auth/profiles"], data.profiles);

      return data;
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  if (result.data && !seededRef.current) {
    seededRef.current = true;
    const { date_from, date_to } = result.data.calendar_date_range;
    qc.setQueryData(["/api/jobs", { date_from, date_to, limit: 500 }], result.data.calendar_jobs);
    qc.setQueryData(["/api/auth/profiles"], result.data.profiles);
  }

  return result;
}
