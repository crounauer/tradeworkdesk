import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient, useQuery } from "@tanstack/react-query";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  tenant_id?: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null | undefined;
  isLoading: boolean;
  mfaPending: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const queryClient = useQueryClient();

  const checkMfaStatus = async () => {
    try {
      const result = await withTimeout(
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        5000
      );
      if (result && result.data) {
        const { data: aalData } = result;
        if (aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1") {
          setMfaPending(true);
        } else {
          setMfaPending(false);
        }
      }
    } catch {
      setMfaPending(false);
    }
  };

  useEffect(() => {
    const sessionTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        await checkMfaStatus();
      }
      setIsLoading(false);
    }).catch(() => {
      clearTimeout(sessionTimeout);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        setMfaPending(false);
        return;
      }

      if (event === "SIGNED_IN") {
        queryClient.invalidateQueries({ queryKey: ["me-init"] });
      }

      if (session) {
        await checkMfaStatus();
      } else {
        setMfaPending(false);
      }

      if (event === "SIGNED_IN" && session?.access_token) {
        const pendingCode = localStorage.getItem("pending_invite_code");
        if (pendingCode) {
          localStorage.removeItem("pending_invite_code");
          fetch("/api/auth/use-invite", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ code: pendingCode }),
          }).catch(() => {});
        }
      }
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: initData } = useQuery({
    queryKey: ["me-init"],
    queryFn: async () => {
      const res = await fetch("/api/me/init");
      if (!res.ok) return { profile: null };
      return res.json();
    },
    enabled: !!session,
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  });
  const profile = initData?.profile as Profile | null | undefined;

  const signOut = () => {
    supabase.auth.signOut({ scope: "local" }).catch(() => {});

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    }

    setSession(null);
    setUser(null);
    setMfaPending(false);
    queryClient.clear();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, mfaPending, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthProvider, useAuth };
