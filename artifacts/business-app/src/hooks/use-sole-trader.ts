import { useInitData } from "./use-init-data";

export function useIsSoleTrader() {
  const { data, isLoading } = useInitData();

  const tenantInfo = data?.tenant;
  const isSoleTrader = tenantInfo?.company_type === "sole_trader";

  return {
    isSoleTrader,
    companyType: (tenantInfo?.company_type as "sole_trader" | "company" | undefined) ?? "company",
    isLoading,
  };
}
