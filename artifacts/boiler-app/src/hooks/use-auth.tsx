import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { useGetProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const queryClient = useQueryClient();

  const checkMfaStatus = async () => {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1") {
      setMfaPending(true);
    } else {
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
      queryClient.clear();

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

  const { data: profile } = useGetProfile();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile: profile as Profile | null | undefined, isLoading, mfaPending, signOut }}>
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
