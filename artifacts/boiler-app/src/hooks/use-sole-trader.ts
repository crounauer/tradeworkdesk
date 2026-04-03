import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function useIsSoleTrader() {
  const { profile } = useAuth();

  const { data: tenantInfo, isLoading } = useQuery({
    queryKey: ["me-tenant"],
    queryFn: async () => {
      const res = await fetch("/api/me/tenant");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!profile && profile.role !== "super_admin",
    staleTime: 60_000,
  });

  const isSoleTrader = tenantInfo?.company_type === "sole_trader";

  return {
    isSoleTrader,
    companyType: (tenantInfo?.company_type as "sole_trader" | "company" | undefined) ?? "company",
    isLoading,
  };
}
