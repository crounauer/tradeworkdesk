import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { useGetProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: { id: string; email: string; full_name: string; role: string; phone?: string | null } | null | undefined;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Clear all cached query data when auth state changes to prevent
      // stale data from being refetched with an old/wrong role.
      queryClient.clear();

      // If a pending invite code was stored during sign-up (email verification flow),
      // apply it now that the user has an active session.
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

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data: profile } = useGetProfile();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut }}>
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
