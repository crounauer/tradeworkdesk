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
  isImpersonating: boolean;
  signOut: () => void;
};

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);
const PORTAL_IMPERSONATION_STORAGE_KEY = "portal_impersonation_token";

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [impersonationToken, setImpersonationToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const tokenFromQuery = params.get("impersonation");
    const tokenFromStorage = sessionStorage.getItem(PORTAL_IMPERSONATION_STORAGE_KEY);
    const resolvedToken = tokenFromQuery || tokenFromStorage;

    if (resolvedToken) {
      sessionStorage.setItem(PORTAL_IMPERSONATION_STORAGE_KEY, resolvedToken);
      setImpersonationToken(resolvedToken);
      setIsLoading(false);
    }

    if (tokenFromQuery) {
      params.delete("impersonation");
      const nextQuery = params.toString();
      const cleaned = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", cleaned);
    }
  }, []);

  useEffect(() => {
    const sessionTimeout = setTimeout(() => setIsLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(sessionTimeout);
      if (!impersonationToken) {
        setSession(session);
      }
      setIsLoading(false);

      if (_event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, [impersonationToken, queryClient]);

  const authToken = impersonationToken || session?.access_token || null;
  const effectiveSession = authToken
    ? ({ access_token: authToken } as Session)
    : null;

  const { data: profile } = useQuery<PortalProfile | null>({
    queryKey: ["portal-profile", authToken],
    queryFn: async () => {
      const token = authToken;
      if (!token) return null;
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!authToken,
    staleTime: 60_000,
  });

  const customerName = profile?.customer
    ? `${profile.customer.first_name} ${profile.customer.last_name}`
    : "";
  const companyName = profile?.company_name || "";
  const isImpersonating = !!impersonationToken;

  const signOut = () => {
    if (impersonationToken) {
      sessionStorage.removeItem(PORTAL_IMPERSONATION_STORAGE_KEY);
      setImpersonationToken(null);
      setSession(null);
      queryClient.clear();
      window.location.href = `${import.meta.env.BASE_URL}customers`;
      return;
    }

    supabase.auth.signOut({ scope: "local" }).catch(() => {});
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    }
    setSession(null);
    queryClient.clear();
    window.location.href = `${import.meta.env.BASE_URL}portal/login`;
  };

  return (
    <PortalAuthContext.Provider value={{ session: effectiveSession, profile: profile || null, isLoading, customerName, companyName, isImpersonating, signOut }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (!context) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return context;
}
