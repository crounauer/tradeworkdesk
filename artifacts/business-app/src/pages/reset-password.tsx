import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Flame, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const syncRecoveryState = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setReady(!!data.session);
      setCheckingSession(false);
    };

    syncRecoveryState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setCheckingSession(false);
        return;
      }

      setReady(!!session);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });

      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({
        title: "Reset failed",
        description: err instanceof Error ? err.message : "Could not update your password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">
      <img
        src={`${import.meta.env.BASE_URL}images/login-bg.png`}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
      />

      <div className="w-full max-w-md p-8 glass-panel rounded-3xl relative z-10 m-4">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reset password</h1>
          <p className="text-muted-foreground mt-2">
            Set a new password for your TradeWorkDesk account.
          </p>
        </div>

        {checkingSession ? (
          <div className="text-center text-sm text-muted-foreground">Checking your reset link...</div>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <KeyRound className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">Choose a new password with at least 8 characters.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? "Updating password..." : "Update Password"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              This reset link is missing or has expired. Request a fresh one from the login screen.
            </p>
            <Button asChild className="w-full h-12 text-base">
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}