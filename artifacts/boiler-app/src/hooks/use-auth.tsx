import { createContext, useContext, useEffect, useState, useRef } from "react";
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
  profileReady: boolean;
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

function prefetchCriticalData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.prefetchQuery({
    queryKey: ["me-init"],
    queryFn: async () => {
      const res = await fetch("/api/me/init");
      if (!res.ok) throw new Error(`me/init failed: ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  queryClient.prefetchQuery({
    queryKey: ["homepage"],
    queryFn: async () => {
      const res = await fetch("/api/homepage");
      if (!res.ok) throw new Error(`homepage failed: ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const queryClient = useQueryClient();
  const hasPrefetched = useRef(false);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      if (event === "INITIAL_SESSION") {
        clearTimeout(sessionTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        if (session && !hasPrefetched.current) {
          hasPrefetched.current = true;
          prefetchCriticalData(queryClient);
        }
        setIsLoading(false);
        if (session) checkMfaStatus();
        return;
      }

      // Prevent redundant state updates
      setSession(prev => {
        if (prev?.access_token === session?.access_token) return prev;
        return session;
      });

      setUser(prev => {
        if (prev?.id === session?.user?.id) return prev;
        return session?.user ?? null;
      });

      if (event === "SIGNED_OUT") {
        hasPrefetched.current = false;
        // queryClient.clear(); // disabled - causing refetch loop
        setMfaPending(false);
        return;
      }

      if (event === "SIGNED_IN") {
        // queryClient.removeQueries({ queryKey: ["me-init"] }); // disabled
        hasPrefetched.current = false;
        prefetchCriticalData(queryClient);
        hasPrefetched.current = true;
      }

      if (session) {
        checkMfaStatus();
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

  const { data: initData, isLoading: profileLoading } = useQuery({
    queryKey: ["me-init"],
    queryFn: async () => {
      const res = await fetch("/api/me/init");
      if (!res.ok) console.log("AUTH STATE:", { session, user });
return { profile: null };
      return res.json();
    },
    enabled: !!session,
    staleTime: 60_000,
    // refetchInterval removed,
  });
  const profile = initData?.profile as Profile | null | undefined;
  const profileReady = !session || !profileLoading;

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
    hasPrefetched.current = false;
    // queryClient.clear(); // disabled - causing refetch loop
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, profileReady, mfaPending, signOut }}>
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
