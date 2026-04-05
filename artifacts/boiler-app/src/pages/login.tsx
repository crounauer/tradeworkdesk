import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Login() {
  const { mfaPending } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Login Failed",
        description: error.message,
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
