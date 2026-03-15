import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type LookupOption = {
  id: string;
  category: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function useLookupOptions(category: string) {
  return useQuery<LookupOption[]>({
    queryKey: ["/api/lookup-options", category],
    queryFn: () => apiFetch(`/api/lookup-options?category=${category}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllLookupOptions() {
  return useQuery<LookupOption[]>({
    queryKey: ["/api/admin/lookup-options"],
    queryFn: () => apiFetch("/api/admin/lookup-options"),
    staleTime: 0,
  });
}

export function useCreateLookupOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category: string; value: string; label: string; sort_order?: number }) =>
      apiFetch("/api/admin/lookup-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/lookup-options"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/lookup-options"] });
    },
  });
}

export function useUpdateLookupOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; label?: string; sort_order?: number; is_active?: boolean }) =>
      apiFetch(`/api/admin/lookup-options/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/lookup-options"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/lookup-options"] });
    },
  });
}

export function useDeleteLookupOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/admin/lookup-options/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/lookup-options"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/lookup-options"] });
    },
  });
}
