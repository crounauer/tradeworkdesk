import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CompanySettings {
  id?: string;
  singleton_id?: string;
  name?: string | null;
  trading_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  gas_safe_number?: string | null;
  oftec_number?: string | null;
  vat_number?: string | null;
  company_number?: string | null;
  logo_url?: string | null;
  logo_storage_path?: string | null;
  default_hourly_rate?: number | null;
  call_out_fee?: number | null;
  default_vat_rate?: number | null;
  default_payment_terms_days?: number | null;
  currency?: string | null;
  rates_url?: string | null;
  trading_terms_url?: string | null;
  job_number_prefix?: string | null;
  google_calendar_enabled?: boolean | null;
  google_client_id?: string | null;
  google_client_secret?: string | null;
  created_at?: string;
  updated_at?: string;
}

const QUERY_KEY = ["/api/company-settings"];

export function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/company-settings");
      if (!res.ok) {
        if (res.status === 404) return {};
        throw new Error("Failed to load company settings");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CompanySettings>) => {
      const res = await fetch("/api/admin/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to save settings");
      }
      return res.json() as Promise<CompanySettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}

export function useUploadCompanyLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch("/api/admin/company-settings/logo", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to upload logo");
      }
      return res.json() as Promise<{ logo_url: string; logo_storage_path: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
