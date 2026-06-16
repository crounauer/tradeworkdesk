import { useQuery } from "@tanstack/react-query";

export interface HomepageData {
  dashboard: unknown;
  storage?: { used_bytes: number; file_count: number; signature_count: number };
}

export function useHomepageData() {
  return useQuery<HomepageData>({
    queryKey: ["homepage"],
    queryFn: async () => {
      const res = await fetch("/api/homepage");
      if (!res.ok) throw new Error("Failed to fetch homepage data");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}
