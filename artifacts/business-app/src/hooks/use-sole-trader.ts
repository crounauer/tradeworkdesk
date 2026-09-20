import { useInitData } from "./use-init-data";

export function useIsSoleTrader() {
  const { isLoading } = useInitData();

  return {
    isSoleTrader: false,
    companyType: "company" as const,
    isLoading,
  };
}
