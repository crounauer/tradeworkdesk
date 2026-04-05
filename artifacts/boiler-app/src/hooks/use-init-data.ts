import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PlanFeatures } from "./use-plan-features";

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
}

function useHasSession() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return hasSession;
}

export function useInitData() {
  const hasSession = useHasSession();

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
        };
      }
      return res.json();
    },
    enabled: hasSession,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  });
}
