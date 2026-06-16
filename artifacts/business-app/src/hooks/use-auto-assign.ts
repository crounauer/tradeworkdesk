import { useInitData } from "./use-init-data";

/**
 * Returns true when jobs should auto-assign to the creator rather than showing
 * a technician picker.
 * - Always true for sole traders (they do their own field work by definition).
 * - True for company accounts that only have 1 active user.
 * As soon as a company adds a second user the picker becomes visible.
 */
export function useAutoAssign() {
  const { data, isLoading } = useInitData();
  const currentUsers = data?.usageLimits?.currentUsers ?? 1;
  const isSoleTrader = data?.tenant?.company_type === "sole_trader";
  const autoAssign = !isLoading && (isSoleTrader || currentUsers <= 1);

  return { autoAssign, currentUsers, isSoleTrader, isLoading };
}
