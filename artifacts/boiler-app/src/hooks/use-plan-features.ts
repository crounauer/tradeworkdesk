import { useQuery } from "@tanstack/react-query";

export interface PlanFeatures {
  job_management?: boolean;
  invoicing?: boolean;
  reports?: boolean;
  team_management?: boolean;
  social_media?: boolean;
  heat_pump_forms?: boolean;
  oil_tank_forms?: boolean;
  commissioning_forms?: boolean;
  combustion_analysis?: boolean;
  api_access?: boolean;
  scheduling?: boolean;
  custom_branding?: boolean;
  priority_support?: boolean;
  [key: string]: boolean | undefined;
}

interface TenantPlanInfo {
  plan_id: string | null;
  plan_name: string | null;
  features: PlanFeatures;
}

export function usePlanFeatures() {
  const { data, isLoading } = useQuery<TenantPlanInfo>({
    queryKey: ["tenant-plan-features"],
    queryFn: async () => {
      const res = await fetch("/api/me/plan-features");
      if (!res.ok) return { plan_id: null, plan_name: null, features: {} };
      return res.json();
    },
    staleTime: 60_000,
  });

  const features = data?.features ?? {};

  const hasFeature = (key: string): boolean => {
    return !!features[key];
  };

  const isFormsOnly = !hasFeature("job_management");

  return {
    features,
    hasFeature,
    isFormsOnly,
    planName: data?.plan_name ?? null,
    planId: data?.plan_id ?? null,
    isLoading,
  };
}

export const FEATURE_LABELS: Record<string, string> = {
  job_management: "Job Management",
  invoicing: "Invoicing & Export",
  reports: "Reports Dashboard",
  team_management: "Team Management",
  social_media: "Social Media Scheduling",
  heat_pump_forms: "Heat Pump Forms",
  oil_tank_forms: "Oil Tank Forms",
  commissioning_forms: "Commissioning Forms",
  combustion_analysis: "Combustion Analysis",
  api_access: "API Access",
  scheduling: "Scheduling & Calendar",
  custom_branding: "Custom Branding",
  priority_support: "Priority Support",
};
