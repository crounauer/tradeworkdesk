import { useInitData } from "./use-init-data";

/**
 * Returns true when jobs should auto-assign to the creator rather than showing
 * a technician picker.
 * - True when the tenant has only 1 active user.
 * As soon as a second user is active the picker becomes visible.
 */
export function useAutoAssign() {
  const { data, isLoading } = useInitData();
  const currentUsers = data?.usageLimits?.currentUsers ?? 1;
  const autoAssign = !isLoading && currentUsers <= 1;

  return { autoAssign, currentUsers, isLoading };
}
