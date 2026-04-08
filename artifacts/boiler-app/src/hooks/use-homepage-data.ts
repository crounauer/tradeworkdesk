import { useQuery } from "@tanstack/react-query";

export interface HomepageData {
  dashboard: unknown;
  calendar_jobs: { jobs: unknown[]; pagination: unknown };
  calendar_date_range: { date_from: string; date_to: string };
  profiles: unknown[];
}

export function useHomepageData() {
  return useQuery<HomepageData>({
    queryKey: ["homepage"],
    queryFn: async () => {
      const res = await fetch("/api/homepage");
      if (!res.ok) throw new Error("Failed to fetch homepage data");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}
