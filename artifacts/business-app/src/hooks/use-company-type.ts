import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CompanyTypeInfo {
  company_type: "sole_trader" | "company";
  has_team_management: boolean;
  plan_name: string | null;
  active_user_count: number;
}

export function useCompanyType() {
  const { data, isLoading, isError, error } = useQuery<CompanyTypeInfo>({
    queryKey: ["company-type"],
    queryFn: async () => {
      const res = await fetch("/api/admin/company-type");
      if (!res.ok) {
        throw new Error(`Failed to load company type (${res.status})`);
      }
      return res.json();
    },
    staleTime: 30_000,
    retry: 2,
  });

  return {
    companyType: "company" as const,
    hasTeamManagement: data?.has_team_management ?? false,
    planName: data?.plan_name ?? null,
    activeUserCount: data?.active_user_count ?? 1,
    isSoleTrader: false,
    isCompany: true,
    isLoading,
    isError,
    error,
  };
}

export function useUpgradeToCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/company-type/upgrade", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upgrade");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-type"] });
      qc.invalidateQueries({ queryKey: ["me-init"] });
      qc.invalidateQueries({ queryKey: ["tenant-info"] });
      toast({ title: "Workspace updated", description: "Team features are available through users, roles, and job assignment." });
    },
    onError: (e: Error) => {
      toast({ title: "Upgrade failed", description: e.message, variant: "destructive" });
    },
  });
}

export function useDowngradeToSoleTrader() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/company-type/downgrade", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to downgrade");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-type"] });
      qc.invalidateQueries({ queryKey: ["me-init"] });
      qc.invalidateQueries({ queryKey: ["tenant-info"] });
      toast({ title: "Workspace updated", description: "Access is managed through users, roles, and job assignment." });
    },
    onError: (e: Error) => {
      toast({ title: "Downgrade failed", description: e.message, variant: "destructive" });
    },
  });
}
