import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PlanFeatures } from "./use-plan-features";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: string;
  starts_at: string;
  ends_at: string | null;
  target_tenant_ids?: string[] | null;
  target_admin_dashboard?: boolean;
  target_websites?: boolean;
}

export interface ActiveAddon {
  addon_id: string;
  name: string | null;
  feature_keys: string[];
}

export interface UsageLimits {
  maxUsers: number;
  currentUsers: number;
  baseMaxUsers: number;
  addonExtraUsers: number;
  maxJobsPerMonth: number;
  currentJobsThisMonth: number;
  baseMaxJobsPerMonth: number;
  addonExtraJobs: number;
}

export interface InitData {
  profile: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    phone?: string | null;
    tenant_id?: string | null;
  } | null;
  planFeatures: {
    plan_id: string | null;
    plan_name: string | null;
    features: PlanFeatures;
  };
  tenant: {
    id: string;
    company_name: string;
    company_type?: string;
    status: string;
    trial_ends_at?: string | null;
    subscription_renewal_at?: string | null;
    stripe_customer_id?: string | null;
    plan_id?: string | null;
    plans?: Record<string, unknown> | null;
    subscription?: Record<string, unknown> | null;
  } | null;
  enquiriesCount: number;
  overdueFollowUpsCount: number;
  activeFollowUpsCount: number;
  todosCount: number;
  announcements?: Announcement[];
  activeAddons?: ActiveAddon[];
  usageLimits?: UsageLimits | null;
}

export const initDataQueryOptions = queryOptions({
  queryKey: ["me-init"],
  queryFn: async ({ signal }): Promise<InitData> => {
    const res = await fetchWithTimeout("/api/me/init", { signal });
    if (res.status === 401) {
      throw new Error("unauthorized");
    }
    if (!res.ok) {
      throw new Error("Unable to load your account. The service may be temporarily unavailable. Please try again.");
    }
    return res.json();
  },
  staleTime: 5 * 60_000,
  retry: false,
  retryOnMount: false,
});

export function useInitData() {
  return useQuery(initDataQueryOptions);
}
