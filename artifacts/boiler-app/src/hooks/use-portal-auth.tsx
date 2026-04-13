import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type PortalProfile = {
  customer: {
    id: string;
    title?: string | null;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
  };
  company_name: string | null;
  portal_user_id: string;
};

type PortalAuthContextType = {
  session: Session | null;
  profile: PortalProfile | null;
  isLoading: boolean;
  customerName: string;
  companyName: string;
  signOut: () => void;
};

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  useEffect(() => {
    const sessionTimeout = setTimeout(() => setIsLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setIsLoading(false);

      if (_event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: profile } = useQuery<PortalProfile | null>({
    queryKey: ["portal-profile"],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) return null;
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!session,
    staleTime: 60_000,
  });

  const customerName = profile?.customer
    ? `${profile.customer.first_name} ${profile.customer.last_name}`
    : "";
  const companyName = profile?.company_name || "";

  const signOut = () => {
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    }
    setSession(null);
    queryClient.clear();
    window.location.href = `${import.meta.env.BASE_URL}portal/login`;
  };

  return (
    <PortalAuthContext.Provider value={{ session, profile: profile || null, isLoading, customerName, companyName, signOut }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (!context) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return context;
}
