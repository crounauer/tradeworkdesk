import { useInitData } from "./use-init-data";

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
  geo_mapping?: boolean;
  custom_branding?: boolean;
  priority_support?: boolean;
  todo_list?: boolean;
  [key: string]: boolean | undefined;
}

export function usePlanFeatures() {
  const { data, isLoading, isError } = useInitData();

  const pf = data?.planFeatures;
  const features = pf?.features ?? {};

  const hasFeature = (key: string): boolean => {
    // While loading or if auth failed (stale data preserved), assume access
    if (isLoading || isError) return true;
    return !!features[key];
  };

  const addons = data?.activeAddons ?? [];

  const hasAddon = (featureKey: string): boolean => {
    if (isLoading) return true;
    return addons.some((a) => a.feature_keys?.includes(featureKey));
  };

  const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
  const isFormsOnly = !hasFeature("job_management");
  const isFreePlan = pf?.plan_id === FREE_PLAN_ID;

  return {
    features,
    hasFeature,
    hasAddon,
    isFormsOnly,
    isFreePlan,
    planName: pf?.plan_name ?? null,
    planId: pf?.plan_id ?? null,
    activeAddons: addons,
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
  geo_mapping: "Geomapping & Location",
};
