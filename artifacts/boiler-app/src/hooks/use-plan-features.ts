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
  [key: string]: boolean | undefined;
}

export function usePlanFeatures() {
  const { data, isLoading } = useInitData();

  const pf = data?.planFeatures;
  const features = pf?.features ?? {};

  const hasFeature = (key: string): boolean => {
    if (isLoading) return true;
    return !!features[key];
  };

  const isFormsOnly = !hasFeature("job_management");

  return {
    features,
    hasFeature,
    isFormsOnly,
    planName: pf?.plan_name ?? null,
    planId: pf?.plan_id ?? null,
    activeAddons: data?.activeAddons ?? [],
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
