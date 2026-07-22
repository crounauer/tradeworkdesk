import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

function getLoginErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  if (normalized === "invalid login credentials") {
    return "Invalid email or password. If this is a new account, confirm your email first or use Forgot password.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Check your email and confirm your account before signing in.";
  }

  return message;
}

function getResetErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit exceeded") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many")
  ) {
    return "Password reset emails are temporarily rate-limited. Please wait before trying again, or ask support to increase Supabase Auth email limits.";
  }

  return message;
}

export default function Login() {
  const { mfaPending } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [lastResetAttemptAt, setLastResetAttemptAt] = useState<number | null>(null);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (mfaPending) {
      initMfaFromPending();
    }
  }, [mfaPending]);

  const initMfaFromPending = async () => {
    const { data: factorsData, error } = await supabase.auth.mfa.listFactors();
    if (error || !factorsData?.totp?.length) {
      toast({ title: "MFA Error", description: "Could not load MFA factors. Please try again.", variant: "destructive" });
      return;
    }
    const totpFactor = factorsData.totp.find(f => f.status === "verified");
    if (totpFactor) {
      setMfaFactorId(totpFactor.id);
      setShowMfa(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      toast({
        title: "Login Failed",
        description: getLoginErrorMessage(error.message),
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    const inlineTotp = data.user?.factors?.find(
      (f: { factor_type: string; status: string }) => f.factor_type === "totp" && f.status === "verified"
    );
    if (inlineTotp) {
      setMfaFactorId(inlineTotp.id);
      setShowMfa(true);
      setLoading(false);
      return;
    }

    try {
      const factorsResult = await Promise.race([
        supabase.auth.mfa.listFactors(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (factorsResult && "data" in factorsResult && factorsResult.data?.totp?.length) {
        const verifiedTotp = factorsResult.data.totp.find((f: { status: string }) => f.status === "verified");
        if (verifiedTotp) {
          setMfaFactorId(verifiedTotp.id);
          setShowMfa(true);
          setLoading(false);
          return;
        }
      }
    } catch {
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    const now = Date.now();
    if (lastResetAttemptAt && now - lastResetAttemptAt < 60_000) {
      toast({
        title: "Please wait",
        description: "A reset email was requested recently. Check your inbox or try again in about a minute.",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast({
        title: "Email required",
        description: "Enter your email address first so we can send a reset link.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setLastResetAttemptAt(now);

      toast({
        title: "Reset email sent",
        description: "Check your inbox for a password reset link.",
      });
    } catch (err) {
      setLastResetAttemptAt(now);
      toast({
        title: "Reset failed",
        description: err instanceof Error
          ? getResetErrorMessage(err.message)
          : "Could not send a password reset email.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (mfaCode.length !== 6) return;
    setMfaVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      setShowMfa(false);
    } catch (err) {
      toast({
        title: "Verification Failed",
        description: err instanceof Error ? err.message : "Invalid code. Please try again.",
        variant: "destructive"
      });
      setMfaCode("");
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    setShowMfa(false);
    setMfaCode("");
    setMfaFactorId("");
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">
      <img 
        src={`${import.meta.env.BASE_URL}images/login-bg.png`}
        alt="Background" 
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply"
      />
      
      <div className="w-full max-w-md p-8 glass-panel rounded-3xl relative z-10 m-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">TradeWorkDesk</h1>
          {showMfa ? (
            <p className="text-muted-foreground mt-2 text-center">Enter your authenticator code to continue.</p>
          ) : (
            <>
              <p className="text-muted-foreground mt-2 text-center">Sign in to access your field service dashboard.</p>
              <p className="text-xs text-muted-foreground mt-1 text-center">Have an invite link? <a href="/register" className="text-primary hover:underline font-medium">Create an account</a></p>
            </>
          )}
        </div>

        {showMfa ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">Two-factor authentication is enabled on this account.</p>
            </div>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={mfaCode} onChange={setMfaCode} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button className="w-full h-12 text-base" onClick={handleMfaVerify} disabled={mfaVerifying || mfaCode.length !== 6}>
              {mfaVerifying ? "Verifying..." : "Verify"}
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleBackToLogin}>
              Back to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="technician@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
              >
                {resetLoading ? "Sending reset link..." : "Forgot password?"}
              </button>
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
