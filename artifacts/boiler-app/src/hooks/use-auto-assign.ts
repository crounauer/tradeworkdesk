import { useInitData } from "./use-init-data";

/**
 * Returns true when jobs should auto-assign to the creator rather than showing
 * a technician picker. This is the case when there is only one active user on
 * the account — regardless of legal business structure (sole trader / company).
 * As soon as a second user joins the system the picker becomes visible.
 */
export function useAutoAssign() {
  const { data, isLoading } = useInitData();
  const currentUsers = data?.usageLimits?.currentUsers ?? 1;
  const autoAssign = !isLoading && currentUsers <= 1;

  return { autoAssign, currentUsers, isLoading };
}
