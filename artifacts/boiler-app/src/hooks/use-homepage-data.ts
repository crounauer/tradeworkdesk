import { useQuery } from "@tanstack/react-query";

export interface HomepageData {
  dashboard: unknown;
  calendar_jobs: { jobs: unknown[]; pagination: unknown };
  calendar_date_range: { date_from: string; date_to: string };
  profiles: unknown[];
  storage?: { used_bytes: number; file_count: number; signature_count: number };
}

export function useHomepageData() {
  return useQuery<HomepageData>({
    queryKey: ["homepage"],
    queryFn: async () => {
      console.log("QUERY RUNNING");
      const res = await fetch("/api/homepage");
      if (!res.ok) throw new Error("Failed to fetch homepage data");
      const data = await res.json();
      console.log("HOMEPAGE DATA:", data);
      return data;
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    // refetchInterval removed,
  });
}
