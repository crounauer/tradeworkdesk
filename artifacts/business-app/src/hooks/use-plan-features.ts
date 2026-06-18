import { useInitData } from "./use-init-data";

export interface PlanFeatures {
  job_management?: boolean;
  website_builder?: boolean;
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
    if (isLoading) return true;
    // If a feature is explicitly present in the resolved map, respect it.
    if (Object.prototype.hasOwnProperty.call(features, key)) return !!features[key];
    // Preserve existing behavior for features not explicitly mapped.
    return true;
  };

  const addons = data?.activeAddons ?? [];

  const hasAddon = (featureKey: string): boolean => {
    if (isLoading) return true;
    // Fall back to plan features so the new all-inclusive plan works
    // without requiring active addon records.
    return addons.some((a) => a.feature_keys?.includes(featureKey)) || !!features[featureKey];
  };

  const FREE_PLAN_ID = "00000000-0000-0000-0000-000000000000";
  const isFreePlan = pf?.plan_id === FREE_PLAN_ID;

  return {
    features,
    hasFeature,
    hasAddon,
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
