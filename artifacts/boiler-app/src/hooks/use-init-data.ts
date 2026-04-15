import { useQuery } from "@tanstack/react-query";
import type { PlanFeatures } from "./use-plan-features";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: string;
  starts_at: string;
  ends_at: string | null;
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
  announcements?: Announcement[];
  activeAddons?: ActiveAddon[];
  usageLimits?: UsageLimits | null;
}

export function useInitData() {
  return useQuery<InitData>({
    queryKey: ["me-init"],
    queryFn: async () => {
      const res = await fetch("/api/me/init");
      if (!res.ok) {
        return {
          profile: null,
          planFeatures: { plan_id: null, plan_name: null, features: {} },
          tenant: null,
          enquiriesCount: 0,
          overdueFollowUpsCount: 0,
        };
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}
